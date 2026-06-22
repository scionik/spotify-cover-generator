const sharp = require('sharp');
const axios = require('axios');

const CANVAS_SIZE = 1000;
const CENTER = CANVAS_SIZE / 2;
const DEFAULTS = {
  maxTracks: 200,
  maxRadius: 75,
  minRadius: 8,
  padding: 3,
  background: 'black',
};

function getSizeForRank(rank, total, maxR, minR) {
  const t = total > 1 ? rank / (total - 1) : 0;
  return Math.round(maxR - (maxR - minR) * Math.pow(t, 0.45));
}

class SpatialHash {
  constructor(cellSize = 100, padding = 3) {
    this.cells = new Map();
    this.cellSize = cellSize;
    this.padding = padding;
  }

  _keys(x, y, r) {
    const c = this.cellSize;
    const keys = [];
    for (let cx = Math.floor((x - r) / c); cx <= Math.floor((x + r) / c); cx++) {
      for (let cy = Math.floor((y - r) / c); cy <= Math.floor((y + r) / c); cy++) {
        keys.push(`${cx},${cy}`);
      }
    }
    return keys;
  }

  add(circle) {
    for (const k of this._keys(circle.x, circle.y, circle.r)) {
      if (!this.cells.has(k)) this.cells.set(k, []);
      this.cells.get(k).push(circle);
    }
  }

  overlaps(x, y, r) {
    for (const k of this._keys(x, y, r)) {
      const cell = this.cells.get(k);
      if (!cell) continue;
      for (const c of cell) {
        if (Math.hypot(x - c.x, y - c.y) < r + c.r + this.padding) return true;
      }
    }
    return false;
  }
}

function packCircles(radii, padding) {
  // Pre-build candidate grid sorted by distance from center (closest first)
  const STEP = 3;
  const candidates = [];
  for (let x = 0; x <= CANVAS_SIZE; x += STEP) {
    for (let y = 0; y <= CANVAS_SIZE; y += STEP) {
      candidates.push({ x, y, d: Math.hypot(x - CENTER, y - CENTER) });
    }
  }
  candidates.sort((a, b) => a.d - b.d);

  const hash = new SpatialHash(100, padding);
  const placed = [];

  for (const r of radii) {
    let found = false;
    for (const { x, y } of candidates) {
      if (x - r < 0 || x + r > CANVAS_SIZE || y - r < 0 || y + r > CANVAS_SIZE) continue;
      if (!hash.overlaps(x, y, r)) {
        const circle = { x, y, r };
        placed.push(circle);
        hash.add(circle);
        found = true;
        break;
      }
    }
    if (!found) break; // canvas is full
  }

  return placed;
}

async function fetchImageBuffer(url) {
  const res = await axios.get(url, { responseType: 'arraybuffer', timeout: 8000 });
  return Buffer.from(res.data);
}

async function makeCircle(imageBuffer, diameter) {
  const r = diameter / 2;
  const mask = Buffer.from(`<svg><circle cx="${r}" cy="${r}" r="${r}"/></svg>`);
  return sharp(imageBuffer)
    .resize(diameter, diameter, { fit: 'cover', position: 'centre' })
    .composite([{ input: mask, blend: 'dest-in' }])
    .png()
    .toBuffer();
}

async function generateCover(tracks, opts = {}) {
  const { maxTracks, maxRadius, minRadius, padding, background } = { ...DEFAULTS, ...opts };
  const subset = tracks.slice(0, maxTracks);
  const total = subset.length;
  const radii = subset.map((_, i) => getSizeForRank(i, total, maxRadius, minRadius));

  console.log(`Packing ${total} circles...`);
  const positions = packCircles(radii, padding);
  console.log(`Placed ${positions.length} / ${total} circles`);

  const bg = background === 'white' ? { r: 255, g: 255, b: 255 } : { r: 10, g: 10, b: 10 };
  const canvas = sharp({
    create: { width: CANVAS_SIZE, height: CANVAS_SIZE, channels: 3, background: bg },
  }).png();

  const composites = [];
  for (let i = 0; i < positions.length; i++) {
    const { x, y, r } = positions[i];
    const diameter = r * 2;
    try {
      const raw = await fetchImageBuffer(subset[i].imageUrl);
      const circle = await makeCircle(raw, diameter);
      composites.push({ input: circle, left: Math.round(x - r), top: Math.round(y - r) });
    } catch {
      // skip if image fails to load
    }
  }

  // Spotify requires ≤256KB base64-encoded — base64 adds ~33% overhead so raw cap is ~190KB
  const RAW_LIMIT = 190 * 1024;
  let quality = 80;
  let outputBuffer;
  do {
    outputBuffer = await canvas.clone().composite(composites).jpeg({ quality }).toBuffer();
    quality -= 5;
  } while (outputBuffer.length > RAW_LIMIT && quality > 20);

  console.log(`Image size: ${Math.round(outputBuffer.length / 1024)}KB at quality ${quality + 5}`);
  return outputBuffer.toString('base64');
}

module.exports = { generateCover };
