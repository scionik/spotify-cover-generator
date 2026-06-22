const CANVAS_SIZE = 1000;
const CENTER = CANVAS_SIZE / 2;

// Pre-build candidates once when worker starts
const CANDIDATES = (() => {
  const STEP = 3;
  const pts = [];
  for (let x = 0; x <= CANVAS_SIZE; x += STEP)
    for (let y = 0; y <= CANVAS_SIZE; y += STEP)
      pts.push({ x, y, d: Math.hypot(x - CENTER, y - CENTER) });
  pts.sort((a, b) => a.d - b.d);
  return pts;
})();

function getSizeForRank(rank, total, maxR, minR) {
  const t = total > 1 ? rank / (total - 1) : 0;
  return Math.round(maxR - (maxR - minR) * Math.pow(t, 0.45));
}

function packCircles(radii, padding) {
  const CELL = 100;
  const cells = new Map();

  function cellKeys(x, y, r) {
    const keys = [];
    for (let cx = Math.floor((x - r) / CELL); cx <= Math.floor((x + r) / CELL); cx++)
      for (let cy = Math.floor((y - r) / CELL); cy <= Math.floor((y + r) / CELL); cy++)
        keys.push(`${cx},${cy}`);
    return keys;
  }

  function addToHash(c) {
    for (const k of cellKeys(c.x, c.y, c.r)) {
      if (!cells.has(k)) cells.set(k, []);
      cells.get(k).push(c);
    }
  }

  function overlaps(x, y, r) {
    for (const k of cellKeys(x, y, r)) {
      const cell = cells.get(k);
      if (!cell) continue;
      for (const c of cell)
        if (Math.hypot(x - c.x, y - c.y) < r + c.r + padding) return true;
    }
    return false;
  }

  const placed = [];
  for (const r of radii) {
    for (const { x, y } of CANDIDATES) {
      if (x - r < 0 || x + r > CANVAS_SIZE || y - r < 0 || y + r > CANVAS_SIZE) continue;
      if (!overlaps(x, y, r)) {
        const circle = { x, y, r };
        placed.push(circle);
        addToHash(circle);
        break;
      }
    }
  }
  return placed;
}

self.onmessage = ({ data }) => {
  const { maxTracks, maxRadius, minRadius, padding, totalTracks } = data;
  const count = Math.min(maxTracks, totalTracks);
  const radii = Array.from({ length: count }, (_, i) => getSizeForRank(i, count, maxRadius, minRadius));
  const positions = packCircles(radii, padding);
  self.postMessage({ positions, count });
};
