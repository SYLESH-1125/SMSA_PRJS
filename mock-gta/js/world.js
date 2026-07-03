'use strict';
/* ================= city generation, prerender, minimap, BFS pathfinding ================= */
let tiles = new Uint8Array(MAPW * MAPH);
let blockStyle = {};
let mapCanvas = null, miniBase = null;
let props = [], pickups = [], parkedSpawns = [];

/* points of interest (tiles chosen to sit on sidewalks / lots) */
const POI = {
  spawn:    { x: tileCx(42), y: tileCx(38) },
  hospital: { x: tileCx(50), y: tileCx(14) },
  police:   { x: tileCx(26), y: tileCx(74) },
  giver:    { x: tileCx(40), y: tileCx(38) },
  garage:   { x: tileCx(79), y: tileCx(42) },
  pizza: [
    { x: tileCx(14), y: tileCx(62) },
    { x: tileCx(62), y: tileCx(74) },
    { x: tileCx(86), y: tileCx(26) },
  ],
  demoHydrant: { x: tileCx(50), y: tileCx(42) },
};

const tileAt   = (tx, ty) => (tx < 0 || ty < 0 || tx >= MAPW || ty >= MAPH) ? T.BUILD : tiles[ty * MAPW + tx];
const isSolidT = (tx, ty) => tileAt(tx, ty) === T.BUILD;
const isRoadT  = (tx, ty) => tileAt(tx, ty) === T.ROAD;
const solidAt  = (x, y) => isSolidT(px2tile(x), px2tile(y));
function circleHitsSolid(x, y, r) {
  return solidAt(x - r, y - r) || solidAt(x + r, y - r) ||
         solidAt(x - r, y + r) || solidAt(x + r, y + r) || solidAt(x, y);
}

function genWorld() {
  props.length = 0; pickups.length = 0; parkedSpawns.length = 0; blockStyle = {};
  for (let by = 0; by < 8; by++) for (let bx = 0; bx < 8; bx++) {
    const r = Math.random();
    blockStyle[bx + ',' + by] = r < 0.55 ? 'build' : (r < 0.8 ? 'park' : 'lot');
  }
  blockStyle['3,3'] = 'park';  // plaza + mission giver
  blockStyle['6,3'] = 'lot';   // garage (mission delivery)
  blockStyle['1,1'] = 'lot';
  blockStyle['6,6'] = 'lot';
  blockStyle['4,1'] = 'build';

  for (let y = 0; y < MAPH; y++) for (let x = 0; x < MAPW; x++) {
    const bx = x % 12, by = y % 12;
    let t;
    if (bx < 2 || by < 2) t = T.ROAD;
    else if (bx === 2 || bx === 11 || by === 2 || by === 11) t = T.SIDE;
    else {
      const st = blockStyle[((x / 12) | 0) + ',' + ((y / 12) | 0)];
      t = st === 'build' ? T.BUILD : (st === 'park' ? T.GRASS : T.LOT);
    }
    if (x === 0 || y === 0 || x === MAPW - 1 || y === MAPH - 1) t = T.BUILD;
    tiles[y * MAPW + x] = t;
  }
  placeProps();
  placePickups();
  prerenderMap();
  prerenderMini();
}

function mkProp(kind, x, y) {
  return { kind, x, y, broken: false, fallA: 0, waterT: 0 };
}

function placeProps() {
  for (let gy = 0; gy < 8; gy++) for (let gx = 0; gx < 8; gx++) {
    const x0 = gx * 12, y0 = gy * 12;
    if (Math.random() < 0.7) props.push(mkProp('lamp', tileCx(x0 + 2), tileCx(y0 + 2)));
    if (Math.random() < 0.7) props.push(mkProp('lamp', tileCx(x0 + 11), tileCx(y0 + 11)));
    if (Math.random() < 0.45) props.push(mkProp('hydrant', tileCx(x0 + 2), tileCx(y0 + 6)));
    if (Math.random() < 0.45) props.push(mkProp('hydrant', tileCx(x0 + 6), tileCx(y0 + 11)));
  }
  // guaranteed hydrant for the demo "crime" beat
  const dh = POI.demoHydrant;
  if (!props.some(p => p.kind === 'hydrant' && dist2(p.x, p.y, dh.x, dh.y) < 100)) {
    props.push(mkProp('hydrant', dh.x, dh.y));
  }
}

function placePickups() {
  let n = 0, guard = 0;
  while (n < 26 && guard++ < 600) {
    const tx = randi(3, MAPW - 4), ty = randi(3, MAPH - 4);
    const t = tileAt(tx, ty);
    if (t === T.SIDE || t === T.LOT || t === T.GRASS) {
      pickups.push({ kind: 'money', x: tileCx(tx), y: tileCx(ty), phase: rand(0, TAU), taken: false, respT: 0 });
      n++;
    }
  }
  n = 0; guard = 0;
  while (n < 8 && guard++ < 300) {
    const tx = randi(3, MAPW - 4), ty = randi(3, MAPH - 4);
    const t = tileAt(tx, ty);
    if (t === T.SIDE || t === T.LOT) {
      pickups.push({ kind: 'health', x: tileCx(tx), y: tileCx(ty), phase: rand(0, TAU), taken: false, respT: 0 });
      n++;
    }
  }
}

function relocatePickup(p) {
  for (let i = 0; i < 60; i++) {
    const tx = randi(3, MAPW - 4), ty = randi(3, MAPH - 4);
    const t = tileAt(tx, ty);
    if (t === T.SIDE || t === T.LOT || t === T.GRASS) { p.x = tileCx(tx); p.y = tileCx(ty); return; }
  }
}

/* ---------------- prerender the whole city once ---------------- */
const ROOF_PALETTE = ['#5b4a56', '#4a5668', '#665244', '#56624a', '#6b5a4c', '#544a62'];

function prerenderMap() {
  mapCanvas = document.createElement('canvas');
  mapCanvas.width = WORLDW; mapCanvas.height = WORLDH;
  const g = mapCanvas.getContext('2d');

  // base tiles
  for (let y = 0; y < MAPH; y++) for (let x = 0; x < MAPW; x++) {
    const t = tiles[y * MAPW + x], px = x * TILE, py = y * TILE;
    if (t === T.ROAD) {
      g.fillStyle = '#26262c'; g.fillRect(px, py, TILE, TILE);
      if (Math.random() < 0.08) { g.fillStyle = 'rgba(0,0,0,0.15)'; g.fillRect(px + randi(0, 16), py + randi(0, 16), randi(8, 16), randi(8, 16)); }
    } else if (t === T.SIDE) {
      g.fillStyle = '#787d87'; g.fillRect(px, py, TILE, TILE);
      g.fillStyle = '#696e78'; g.fillRect(px, py + TILE - 1, TILE, 1); g.fillRect(px + TILE - 1, py, 1, TILE);
    } else if (t === T.GRASS) {
      g.fillStyle = '#2c5a30'; g.fillRect(px, py, TILE, TILE);
      g.fillStyle = 'rgba(255,255,255,0.05)';
      for (let i = 0; i < 3; i++) g.fillRect(px + randi(2, 28), py + randi(2, 28), 2, 2);
    } else if (t === T.LOT) {
      g.fillStyle = '#3a3e45'; g.fillRect(px, py, TILE, TILE);
    } else {
      g.fillStyle = '#33363e'; g.fillRect(px, py, TILE, TILE);
    }
  }

  // lane divider dashes
  g.fillStyle = 'rgba(190,165,60,0.85)';
  for (let gx = 0; gx < 8; gx++) {
    const lx = (gx * 12 + 1) * TILE;
    for (let ty = 0; ty < MAPH; ty++) {
      if (ty % 12 >= 2 && isRoadT(gx * 12, ty) && isRoadT(gx * 12 + 1, ty)) g.fillRect(lx - 2, ty * TILE + 7, 4, 18);
    }
  }
  for (let gy = 0; gy < 8; gy++) {
    const ly = (gy * 12 + 1) * TILE;
    for (let tx = 0; tx < MAPW; tx++) {
      if (tx % 12 >= 2 && isRoadT(tx, gy * 12) && isRoadT(tx, gy * 12 + 1)) g.fillRect(tx * TILE + 7, ly - 2, 18, 4);
    }
  }

  // block interiors
  for (let gy = 0; gy < 8; gy++) for (let gx = 0; gx < 8; gx++) {
    const st = blockStyle[gx + ',' + gy];
    const x0 = (gx * 12 + 3) * TILE, y0 = (gy * 12 + 3) * TILE, S = 8 * TILE;
    if (st === 'build') drawBuildingBlock(g, x0, y0, S);
    else if (st === 'park') drawParkBlock(g, x0, y0, S, gx === 3 && gy === 3);
    else drawLotBlock(g, x0, y0, S, gx, gy);
  }
  ensureSportsSpawns();
}

function drawBuildingBlock(g, x0, y0, S) {
  g.fillStyle = 'rgba(0,0,0,0.28)'; g.fillRect(x0 + 7, y0 + 9, S, S);          // drop shadow
  const base = choice(ROOF_PALETTE);
  g.fillStyle = base; g.fillRect(x0, y0, S, S);
  g.fillStyle = 'rgba(255,255,255,0.06)'; g.fillRect(x0, y0, S, 5);            // top light edge
  g.strokeStyle = 'rgba(0,0,0,0.4)'; g.lineWidth = 6; g.strokeRect(x0 + 4, y0 + 4, S - 8, S - 8); // parapet
  if (Math.random() < 0.6) {                                                    // second tone half
    g.fillStyle = 'rgba(0,0,0,0.12)';
    if (Math.random() < 0.5) g.fillRect(x0 + S / 2, y0 + 8, S / 2 - 8, S - 16);
    else g.fillRect(x0 + 8, y0 + S / 2, S - 16, S / 2 - 8);
  }
  const nAC = randi(2, 4);                                                      // AC units
  for (let i = 0; i < nAC; i++) {
    const ax = x0 + randi(20, S - 44), ay = y0 + randi(20, S - 40);
    g.fillStyle = '#9aa0a8'; g.fillRect(ax, ay, 24, 18);
    g.fillStyle = '#6a7078'; g.beginPath(); g.arc(ax + 12, ay + 9, 6, 0, TAU); g.fill();
  }
  if (Math.random() < 0.7) {                                                    // skylights
    const sx = x0 + randi(20, S - 90), sy = y0 + randi(20, S - 30);
    g.fillStyle = 'rgba(120,180,220,0.35)';
    for (let i = 0; i < 3; i++) g.fillRect(sx + i * 26, sy, 18, 12);
  }
  g.fillStyle = '#484048';                                                      // roof door
  g.fillRect(x0 + randi(14, S - 40), y0 + randi(14, S - 30), 20, 16);
}

function drawParkBlock(g, x0, y0, S, plaza) {
  if (plaza) {
    g.fillStyle = '#8d8a80'; g.fillRect(x0, y0, S, S);
    g.strokeStyle = 'rgba(0,0,0,0.18)'; g.lineWidth = 1;
    for (let i = 1; i < 8; i++) {
      g.beginPath(); g.moveTo(x0 + i * 32, y0); g.lineTo(x0 + i * 32, y0 + S); g.stroke();
      g.beginPath(); g.moveTo(x0, y0 + i * 32); g.lineTo(x0 + S, y0 + i * 32); g.stroke();
    }
    const cx = x0 + S / 2, cy = y0 + S / 2;
    g.fillStyle = '#3f6d8e'; g.beginPath(); g.arc(cx, cy, 30, 0, TAU); g.fill();
    g.strokeStyle = '#b8b4a8'; g.lineWidth = 6; g.beginPath(); g.arc(cx, cy, 33, 0, TAU); g.stroke();
    g.fillStyle = '#7fb8d8'; g.beginPath(); g.arc(cx, cy, 8, 0, TAU); g.fill();
    drawTree(g, x0 + 24, y0 + 24); drawTree(g, x0 + S - 24, y0 + 24);
    drawTree(g, x0 + 24, y0 + S - 24); drawTree(g, x0 + S - 24, y0 + S - 24);
    return;
  }
  g.fillStyle = '#877f66';                                                      // cross paths
  g.fillRect(x0, y0 + S / 2 - 6, S, 12); g.fillRect(x0 + S / 2 - 6, y0, 12, S);
  if (Math.random() < 0.35) {
    g.fillStyle = '#2a5470';
    g.beginPath(); g.ellipse(x0 + randi(60, S - 60), y0 + randi(60, S - 60), 34, 24, rand(0, TAU), 0, TAU); g.fill();
  }
  const n = randi(7, 11);
  for (let i = 0; i < n; i++) drawTree(g, x0 + randi(16, S - 16), y0 + randi(16, S - 16));
}

function drawTree(g, x, y) {
  const r = rand(10, 16);
  g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.arc(x + 3, y + 4, r, 0, TAU); g.fill();
  g.fillStyle = '#1e4022'; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
  g.fillStyle = '#2a5c30'; g.beginPath(); g.arc(x - r * 0.25, y - r * 0.25, r * 0.62, 0, TAU); g.fill();
}

function drawLotBlock(g, x0, y0, S, gx, gy) {
  g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = 2;
  for (const rowY of [y0 + 56, y0 + 158]) {
    g.beginPath(); g.moveTo(x0 + 12, rowY); g.lineTo(x0 + S - 12, rowY); g.stroke();
    for (let i = 0; i <= 5; i++) {
      const lx = x0 + 12 + i * 46;
      if (lx > x0 + S - 10) break;
      g.beginPath(); g.moveTo(lx, rowY); g.lineTo(lx, rowY + 40); g.stroke();
      if (i < 5 && Math.random() < 0.5) {
        parkedSpawns.push({ x: lx + 23, y: rowY + 21, a: Math.PI / 2, type: null });
      }
    }
  }
  if (Math.random() < 0.4) {
    g.fillStyle = 'rgba(0,0,0,0.2)';
    g.beginPath(); g.ellipse(x0 + randi(40, S - 40), y0 + randi(40, S - 40), 14, 9, rand(0, TAU), 0, TAU); g.fill();
  }
}

function ensureSportsSpawns() {
  // guarantee a few sports cars for the Hot Wheels mission + demo flavour
  const spots = [['6,3', 79, 45], ['1,1', 19, 21], ['6,6', 79, 81]];
  for (const [key, tx, ty] of spots) {
    if (blockStyle[key] === 'lot') parkedSpawns.push({ x: tileCx(tx), y: tileCx(ty), a: 0, type: 'sports' });
  }
}

function prerenderMini() {
  miniBase = document.createElement('canvas');
  miniBase.width = MAPW * 2; miniBase.height = MAPH * 2;
  const g = miniBase.getContext('2d');
  const cols = { [T.ROAD]: '#4a4e58', [T.SIDE]: '#3a3e48', [T.BUILD]: '#20242e', [T.GRASS]: '#24402a', [T.LOT]: '#31353d' };
  for (let y = 0; y < MAPH; y++) for (let x = 0; x < MAPW; x++) {
    g.fillStyle = cols[tiles[y * MAPW + x]];
    g.fillRect(x * 2, y * 2, 2, 2);
  }
}

/* ---------------- BFS distance fields (cops + autopilot GPS) ---------------- */
function bfsField(tx, ty) {
  const field = new Int16Array(MAPW * MAPH).fill(-1);
  tx = clamp(tx, 0, MAPW - 1); ty = clamp(ty, 0, MAPH - 1);
  if (isSolidT(tx, ty)) {
    const n = findNearestNonSolid(tx, ty);
    tx = n.tx; ty = n.ty;
  }
  const qx = new Int16Array(MAPW * MAPH), qy = new Int16Array(MAPW * MAPH);
  let head = 0, tail = 0;
  qx[tail] = tx; qy[tail] = ty; tail++;
  field[ty * MAPW + tx] = 0;
  while (head < tail) {
    const cx = qx[head], cy = qy[head]; head++;
    const d = field[cy * MAPW + cx];
    for (const dir of DIRS) {
      const nx = cx + dir.dx, ny = cy + dir.dy;
      if (nx < 0 || ny < 0 || nx >= MAPW || ny >= MAPH) continue;
      const i = ny * MAPW + nx;
      if (field[i] !== -1 || tiles[i] === T.BUILD) continue;
      field[i] = d + 1;
      qx[tail] = nx; qy[tail] = ny; tail++;
    }
  }
  return field;
}

function fieldStep(field, tx, ty) {
  if (!field || tx < 0 || ty < 0 || tx >= MAPW || ty >= MAPH) return null;
  const cur = field[ty * MAPW + tx];
  let best = null, bestD = (cur < 0 ? 32000 : cur);
  for (const dir of DIRS) {
    const nx = tx + dir.dx, ny = ty + dir.dy;
    if (nx < 0 || ny < 0 || nx >= MAPW || ny >= MAPH) continue;
    const d = field[ny * MAPW + nx];
    if (d >= 0 && d < bestD) { bestD = d; best = { tx: nx, ty: ny }; }
  }
  return best;
}

function findNearestNonSolid(tx, ty) {
  for (let r = 1; r < 20; r++) {
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
      const nx = tx + dx, ny = ty + dy;
      if (!isSolidT(nx, ny)) return { tx: nx, ty: ny };
    }
  }
  return { tx, ty };
}

function findNearestRoadTile(x, y) {
  const tx = clamp(px2tile(x), 0, MAPW - 1), ty = clamp(px2tile(y), 0, MAPH - 1);
  if (isRoadT(tx, ty)) return { tx, ty };
  for (let r = 1; r < 24; r++) {
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
      if (isRoadT(tx + dx, ty + dy)) return { tx: tx + dx, ty: ty + dy };
    }
  }
  return { tx, ty };
}

function randomRoadTileNear(x, y, minD, maxD) {
  for (let i = 0; i < 40; i++) {
    const ang = rand(0, TAU), d = rand(minD, maxD);
    const tx = px2tile(x + Math.cos(ang) * d), ty = px2tile(y + Math.sin(ang) * d);
    if (tx > 1 && ty > 1 && tx < MAPW - 2 && ty < MAPH - 2 && isRoadT(tx, ty)) return { tx, ty };
  }
  return null;
}
