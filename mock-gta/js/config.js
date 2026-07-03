'use strict';
/* ================= MOCK GTA — config & helpers ================= */
const TILE = 32, MAPW = 96, MAPH = 96;
const WORLDW = MAPW * TILE, WORLDH = MAPH * TILE;
const T = { ROAD: 0, SIDE: 1, BUILD: 2, GRASS: 3, LOT: 4 };
const TAU = Math.PI * 2;

const clamp = (v, a, b) => v < a ? a : (v > b ? b : v);
const lerp  = (a, b, t) => a + (b - a) * t;
const rand  = (a, b) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
const choice = a => a[(Math.random() * a.length) | 0];
const dist  = (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1);
const dist2 = (x1, y1, x2, y2) => { const dx = x2 - x1, dy = y2 - y1; return dx * dx + dy * dy; };
function angDiff(a, b) { let d = (b - a) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; }
const px2tile = v => Math.floor(v / TILE);
const tileCx  = t => t * TILE + TILE / 2;
function fmt$(n) { return '$' + Math.max(0, Math.round(n)).toLocaleString('en-US'); }
function fmtTime(s) {
  s = Math.max(0, Math.floor(s));
  const m = (s / 60) | 0;
  return String(m).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
}

/* 4 cardinal driving directions: E, S, W, N (screen y grows downward) */
const DIRS = [
  { dx: 1, dy: 0, a: 0 },
  { dx: 0, dy: 1, a: Math.PI / 2 },
  { dx: -1, dy: 0, a: Math.PI },
  { dx: 0, dy: -1, a: -Math.PI / 2 },
];

/* ---- car catalogue: maxS px/s, acc px/s², turn rad/s ---- */
const CARS = {
  sedan : { maxS: 330, acc: 250, turn: 2.4, hp: 100, colors: ['#b8433f', '#3f6fb8', '#7f8fa0', '#b0a24a', '#48545e', '#7a4fb0'], name: 'Sedan'   },
  sports: { maxS: 465, acc: 370, turn: 2.9, hp: 90,  colors: ['#ff8c1a', '#e8352e', '#19c2ff', '#c6ff1a'],                       name: 'Cheetah' },
  taxi  : { maxS: 350, acc: 275, turn: 2.6, hp: 100, colors: ['#f2c718'],                                                        name: 'Taxi'    },
  van   : { maxS: 280, acc: 200, turn: 2.0, hp: 120, colors: ['#8f9aa3', '#5e6a72', '#a3552e'],                                  name: 'Van'     },
  police: { maxS: 435, acc: 345, turn: 2.8, hp: 130, colors: ['#eef2f5'],                                                        name: 'Cruiser' },
};
const CIVILIAN_TYPES = ['sedan', 'sedan', 'sedan', 'taxi', 'van', 'sports'];

const PED_SHIRTS = ['#c94f4f', '#4f7dc9', '#4fc985', '#c9b44f', '#9b59c9', '#c97a2e', '#5d6d7e', '#e0e0e0'];
const PED_SKINS  = ['#e8b48c', '#c68e5f', '#9c6b43', '#f0c8a0'];
