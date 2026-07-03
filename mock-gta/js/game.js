'use strict';
/* ================= main game: input, camera, lighting, render loop, UI ================= */
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d', { alpha: false });
let VW = 0, VH = 0;
let cam = { x: WORLDW / 2, y: WORLDH / 2, zoom: 1, shake: 0 };
let state = 'menu', paused = false, worldReady = false;
let dayT = 0.08, darkness = 0, lastDark = 0;
let lightCv = null, lightG = null;
const keys = new Set();
const mouse = { x: 0, y: 0, wx: 0, wy: 0, down: false };
let shownMoney = 250;

const $ = id => document.getElementById(id);
const ui = {};
const miniCtx = $('minimap').getContext('2d');

function resize() {
  VW = window.innerWidth; VH = window.innerHeight;
  canvas.width = VW; canvas.height = VH;
  lightCv = document.createElement('canvas');
  lightCv.width = VW; lightCv.height = VH;
  lightG = lightCv.getContext('2d');
}
window.addEventListener('resize', resize);
resize();

function addShake(m) { cam.shake = Math.min(24, cam.shake + m); }

/* ---------------- controls resolution ---------------- */
function currentDriveControls() {
  if (!player || player.dead) return { up: false, down: false, left: false, right: false, hb: false };
  if (demoMode) return AP.driveC;
  return {
    up: keys.has('KeyW') || keys.has('ArrowUp'),
    down: keys.has('KeyS') || keys.has('ArrowDown'),
    left: keys.has('KeyA') || keys.has('ArrowLeft'),
    right: keys.has('KeyD') || keys.has('ArrowRight'),
    hb: keys.has('Space'),
  };
}
function currentFootControls() {
  if (!player || player.dead) return { up: false, down: false, left: false, right: false };
  if (demoMode) return AP.walkC;
  return {
    up: keys.has('KeyW') || keys.has('ArrowUp'),
    down: keys.has('KeyS') || keys.has('ArrowDown'),
    left: keys.has('KeyA') || keys.has('ArrowLeft'),
    right: keys.has('KeyD') || keys.has('ArrowRight'),
  };
}

/* ---------------- session ---------------- */
function startSession(demo) {
  if (!worldReady) { genWorld(); worldReady = true; }
  vehicles = []; peds = []; bullets = []; particles = []; skids = []; rec = [];
  heat = 0; prevStars = 0; lastCrimeT = -99; copField = null; copSpawnCd = 0;
  gameTime = 0; mission = null; missionIdx = 0; giverCd = 0;
  stats = { topSpeed: 0, driftTime: 0, starsPeak: 0, missions: 0, nearMisses: 0, earned: 0 };
  pickups = pickups.filter(p => !p.demo);
  for (const p of pickups) { p.taken = false; p.respT = 0; }
  for (const pr of props) { pr.broken = false; pr.waterT = 0; pr.fallA = 0; }
  player = mkPlayer(POI.spawn.x, POI.spawn.y);
  shownMoney = player.money;
  spawnParkedCars();
  cam.x = player.x; cam.y = player.y; cam.shake = 0;
  AUD.init();
  $('overlay-start').classList.add('hidden');
  $('overlay-pause').classList.add('hidden');
  $('hud').classList.remove('hidden');
  $('replay-panel').classList.remove('open'); replayOpen = false;
  $('feed').innerHTML = '';
  paused = false; state = 'run';
  cinematic = false; document.body.classList.remove('cine');
  $('btn-cam').classList.remove('active');
  demoMode = demo;
  if (demo) {
    dayT = 0.25;
    AP.start();
    setDemoBanner('PRO DEMO — autopilot is playing');
    $('demo-banner').classList.remove('hidden');
  } else {
    dayT = 0.08;
    AP.stop();
    $('demo-banner').classList.add('hidden');
    FEEL.emit('gameStart');
  }
  // initial life around the player
  for (let i = 0; i < 9; i++) trySpawnTraffic(true);
  for (let i = 0; i < 16; i++) trySpawnPed(true);
}

function setDemoBanner(txt) { $('demo-banner-text').textContent = txt; }

function spawnParkedCars() {
  for (const s of parkedSpawns) {
    const type = s.type || choice(CIVILIAN_TYPES);
    const v = new Vehicle(s.x, s.y, s.a + rand(-0.06, 0.06), type, 'parked');
    vehicles.push(v);
  }
}

/* ---------------- ambient spawners ---------------- */
function trySpawnTraffic(near) {
  let count = 0;
  for (const v of vehicles) if (v.role === 'traffic') count++;
  if (count >= 12 || vehicles.length > 95) return;
  const rt = randomRoadTileNear(cam.x, cam.y, near ? 260 : 560, near ? 700 : 900);
  if (!rt) return;
  const x = tileCx(rt.tx), y = tileCx(rt.ty);
  for (const v of vehicles) if (dist2(v.x, v.y, x, y) < 90 * 90) return;
  const dirs = [0, 1, 2, 3].filter(i => {
    const d = DIRS[i];
    return isRoadT(rt.tx + d.dx, rt.ty + d.dy) && isRoadT(rt.tx + d.dx * 2, rt.ty + d.dy * 2);
  });
  if (!dirs.length) return;
  const dir = choice(dirs);
  const v = new Vehicle(x, y, DIRS[dir].a, choice(CIVILIAN_TYPES), 'traffic');
  v.dir = dir;
  vehicles.push(v);
}

function trySpawnPed(near) {
  let count = 0;
  for (const p of peds) if (!p.cop) count++;
  if (count >= 30) return;
  for (let i = 0; i < 10; i++) {
    const ang = rand(0, TAU), d = rand(near ? 200 : 450, near ? 600 : 900);
    const tx = px2tile(cam.x + Math.cos(ang) * d), ty = px2tile(cam.y + Math.sin(ang) * d);
    if (tileAt(tx, ty) === T.SIDE) {
      peds.push(new Ped(tileCx(tx), tileCx(ty), false));
      return;
    }
  }
}

function despawnFar() {
  for (let i = vehicles.length - 1; i >= 0; i--) {
    const v = vehicles[i];
    if (v.dead || (v.wreck && v.wreckT <= 0)) { vehicles.splice(i, 1); continue; }
    if (v.role === 'traffic' && dist2(v.x, v.y, cam.x, cam.y) > 1900 * 1900) vehicles.splice(i, 1);
  }
  for (let i = peds.length - 1; i >= 0; i--) {
    const p = peds[i];
    if (p.gone) { peds.splice(i, 1); continue; }
    if (!p.cop && dist2(p.x, p.y, cam.x, cam.y) > 1500 * 1500) peds.splice(i, 1);
  }
  for (let i = bullets.length - 1; i >= 0; i--) if (bullets[i].dead) bullets.splice(i, 1);
}

/* ---------------- shooting ---------------- */
function tryShoot() {
  if (!mouse.down || demoMode || !player || player.dead || player.shootCd > 0 || state !== 'run' || paused) return;
  player.shootCd = player.veh ? 0.3 : 0.22;
  const ox = player.veh ? player.veh.x : player.x;
  const oy = player.veh ? player.veh.y : player.y;
  const a = Math.atan2(mouse.wy - oy, mouse.wx - ox);
  player.aimA = a;
  bullets.push(new Bullet(ox + Math.cos(a) * 20, oy + Math.sin(a) * 20, a, false));
  spawnParticle('flash', ox + Math.cos(a) * 24, oy + Math.sin(a) * 24, 0, 0, 0.06, 9, '#fff2c0');
  AUD.shot(); addShake(1.6); addHeat(0.09);
}

function hornAction() {
  if (state !== 'run' || !player || player.dead) return;
  AUD.horn(); FEEL.emit('horn');
  const hx = player.veh ? player.veh.x : player.x;
  const hy = player.veh ? player.veh.y : player.y;
  for (const p of peds) {
    if (!p.cop && !p.down && dist2(p.x, p.y, hx, hy) < 140 * 140) p.flee(hx, hy);
  }
}

/* ---------------- camera ---------------- */
function updateCamera(dt) {
  const t = player.veh || player;
  const lead = 0.26;
  const tx = t.x + (t.vx || 0) * lead;
  const ty = t.y + (t.vy || 0) * lead;
  const k = Math.min(1, (cinematic ? 2.6 : 6.5) * dt);
  cam.x += (tx - cam.x) * k;
  cam.y += (ty - cam.y) * k;
  const zt = cinematic ? 0.8 : 1;
  cam.zoom += (zt - cam.zoom) * Math.min(1, 4 * dt);
  cam.shake *= Math.exp(-6 * dt);
  const half = { x: VW / (2 * cam.zoom), y: VH / (2 * cam.zoom) };
  cam.x = clamp(cam.x, half.x - 60, WORLDW - half.x + 60);
  cam.y = clamp(cam.y, half.y - 60, WORLDH - half.y + 60);
}

function toggleCine() {
  cinematic = !cinematic;
  document.body.classList.toggle('cine', cinematic);
  $('btn-cam').classList.toggle('active', cinematic);
}

/* ---------------- update ---------------- */
function update(dt) {
  gameTime += dt;
  dayT = (dayT + dt / 170) % 1;
  const nightAmt = (1 - Math.cos(dayT * TAU)) / 2;
  darkness = Math.pow(nightAmt, 1.5) * 0.55;
  if (lastDark <= 0.3 && darkness > 0.3) FEEL.emit('nightfall');
  lastDark = darkness;

  AP.update(dt);

  if (player.dead) {
    player.deadT -= dt;
    if (player.deadT <= 0) respawnPlayer();
  } else {
    if (player.veh) { player.x = player.veh.x; player.y = player.veh.y; }
    else updatePlayerFoot(dt);
    mouse.wx = (mouse.x - VW / 2) / cam.zoom + cam.x;
    mouse.wy = (mouse.y - VH / 2) / cam.zoom + cam.y;
    if (!player.veh && !demoMode) player.aimA = Math.atan2(mouse.wy - player.y, mouse.wx - player.x);
    player.shootCd -= dt;
    tryShoot();
    if (demoMode) player.hp = Math.max(player.hp, 25);   // the show must go on
    if (player.hp <= 0) wasted();
  }

  if ((gameTime * 60 | 0) % 30 === 0) { trySpawnTraffic(false); trySpawnPed(false); }

  for (const v of vehicles) v.update(dt);
  collideVehicles();
  for (const p of peds) p.update(dt);
  for (const b of bullets) b.update(dt);
  updateParticles(dt);
  updateSkids(dt);
  updateProps(dt);
  updatePickups(dt);
  updateWanted(dt);
  updateMissions(dt);
  despawnFar();
  updateCamera(dt);
  FEEL.idle(dt);
  if (player.veh && player.veh.speed > 390) FEEL.emit('highSpeed');

  // audio ambience
  const pv = player.veh;
  AUD.engine(!!pv && !player.dead, pv ? clamp(pv.speed / pv.spec.maxS, 0, 1) : 0);
  AUD.skid(!!pv && pv.drifting);
  let sirenOn = false;
  for (const v of vehicles) if (v.role === 'cop' && v.siren) { sirenOn = true; break; }
  AUD.siren(sirenOn && stars() > 0, dt);

  updateHUD();
}

/* ---------------- render ---------------- */
function inView(x, y, pad) {
  const hx = VW / (2 * cam.zoom) + pad, hy = VH / (2 * cam.zoom) + pad;
  return x > cam.x - hx && x < cam.x + hx && y > cam.y - hy && y < cam.y + hy;
}

function render() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#0b0e14';
  ctx.fillRect(0, 0, VW, VH);
  const shx = (Math.random() - 0.5) * cam.shake;
  const shy = (Math.random() - 0.5) * cam.shake;
  ctx.setTransform(cam.zoom, 0, 0, cam.zoom, VW / 2 - cam.x * cam.zoom + shx, VH / 2 - cam.y * cam.zoom + shy);

  if (mapCanvas) ctx.drawImage(mapCanvas, 0, 0);
  drawSkids(ctx);
  for (const p of pickups) if (inView(p.x, p.y, 40)) drawPickup(ctx, p);
  drawMarkers(ctx);
  for (const pr of props) if (inView(pr.x, pr.y, 40)) drawProp(ctx, pr);
  for (const p of peds) if (inView(p.x, p.y, 40)) p.draw(ctx);
  const night = darkness > 0.22;
  for (const v of vehicles) if (inView(v.x, v.y, 80)) v.draw(ctx, night);
  if (player && !player.veh && !player.dead) drawPlayerFoot(ctx);
  for (const b of bullets) b.draw(ctx);
  drawParticles(ctx);

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (darkness > 0.04) drawLighting();
  drawMinimap();
}

function drawMarkers(g) {
  const pulse = 1 + Math.sin(gameTime * 4) * 0.15;
  if (!mission && giverCd <= 0) {
    const m = POI.giver;
    g.strokeStyle = 'rgba(80,220,255,0.9)'; g.lineWidth = 3;
    g.beginPath(); g.arc(m.x, m.y, 17 * pulse, 0, TAU); g.stroke();
    g.fillStyle = 'rgba(80,220,255,0.18)';
    g.beginPath(); g.arc(m.x, m.y, 17 * pulse, 0, TAU); g.fill();
    g.fillStyle = '#bdefff';
    g.font = '700 15px Consolas, monospace';
    g.fillText('!', m.x - 3, m.y + 5);
  }
  if (mission && mission.target) {
    const t = mission.target;
    g.strokeStyle = 'rgba(255,210,60,0.95)'; g.lineWidth = 4;
    g.beginPath(); g.arc(t.x, t.y, 23 * pulse, 0, TAU); g.stroke();
    g.fillStyle = 'rgba(255,210,60,0.15)';
    g.beginPath(); g.arc(t.x, t.y, 23 * pulse, 0, TAU); g.fill();
    const bob = Math.sin(gameTime * 5) * 4;
    g.fillStyle = '#ffd23f';
    g.beginPath();
    g.moveTo(t.x, t.y - 34 + bob); g.lineTo(t.x - 8, t.y - 46 + bob); g.lineTo(t.x + 8, t.y - 46 + bob);
    g.closePath(); g.fill();
  }
}

/* ---------------- night lighting ---------------- */
function w2sX(x) { return (x - cam.x) * cam.zoom + VW / 2; }
function w2sY(y) { return (y - cam.y) * cam.zoom + VH / 2; }

function punchLight(x, y, r, a) {
  const gr = lightG.createRadialGradient(x, y, 0, x, y, r);
  gr.addColorStop(0, 'rgba(0,0,0,' + a + ')');
  gr.addColorStop(1, 'rgba(0,0,0,0)');
  lightG.fillStyle = gr;
  lightG.fillRect(x - r, y - r, r * 2, r * 2);
}

function drawLighting() {
  lightG.globalCompositeOperation = 'source-over';
  lightG.clearRect(0, 0, VW, VH);
  lightG.fillStyle = 'rgba(9,12,36,' + darkness.toFixed(3) + ')';
  lightG.fillRect(0, 0, VW, VH);
  lightG.globalCompositeOperation = 'destination-out';
  const z = cam.zoom;
  for (const pr of props) {
    if (pr.kind === 'lamp' && !pr.broken && inView(pr.x, pr.y, 140)) {
      punchLight(w2sX(pr.x), w2sY(pr.y), 95 * z, 0.85);
    }
  }
  for (const v of vehicles) {
    if (v.wreck || !inView(v.x, v.y, 220)) continue;
    if (v.role === 'parked' && v.speed < 5) continue;
    const fx = Math.cos(v.a), fy = Math.sin(v.a);
    punchLight(w2sX(v.x + fx * 34), w2sY(v.y + fy * 34), 34 * z, 0.8);
    punchLight(w2sX(v.x + fx * 72), w2sY(v.y + fy * 72), 52 * z, 0.5);
  }
  for (const p of particles) {
    if (p.type === 'flame' || p.type === 'flash') {
      punchLight(w2sX(p.x), w2sY(p.y), p.size * 7 * z, 0.7);
    }
  }
  if (player && !player.veh && !player.dead) punchLight(w2sX(player.x), w2sY(player.y), 60 * z, 0.55);
  ctx.drawImage(lightCv, 0, 0);
}

/* ---------------- minimap ---------------- */
function drawMinimap() {
  if (!miniBase) return;
  const S = 192 / WORLDW;
  miniCtx.clearRect(0, 0, 192, 192);
  miniCtx.drawImage(miniBase, 0, 0);
  // viewport
  miniCtx.strokeStyle = 'rgba(255,255,255,0.25)';
  miniCtx.lineWidth = 1;
  miniCtx.strokeRect((cam.x - VW / (2 * cam.zoom)) * S, (cam.y - VH / (2 * cam.zoom)) * S, VW / cam.zoom * S, VH / cam.zoom * S);
  // giver / mission target
  if (!mission && giverCd <= 0) {
    miniCtx.fillStyle = '#50dcff';
    miniCtx.beginPath(); miniCtx.arc(POI.giver.x * S, POI.giver.y * S, 3, 0, TAU); miniCtx.fill();
  }
  if (mission && mission.target) {
    const blink = (gameTime * 3 | 0) % 2 === 0;
    miniCtx.fillStyle = blink ? '#ffd23f' : '#b08d20';
    miniCtx.beginPath(); miniCtx.arc(mission.target.x * S, mission.target.y * S, 3.4, 0, TAU); miniCtx.fill();
  }
  // cops
  miniCtx.fillStyle = '#ff5050';
  for (const v of vehicles) {
    if (v.role === 'cop') { miniCtx.beginPath(); miniCtx.arc(v.x * S, v.y * S, 2.4, 0, TAU); miniCtx.fill(); }
  }
  // player arrow
  const px = (player.veh ? player.veh.x : player.x) * S;
  const py = (player.veh ? player.veh.y : player.y) * S;
  const pa = player.veh ? player.veh.a : player.a;
  miniCtx.save();
  miniCtx.translate(px, py); miniCtx.rotate(pa);
  miniCtx.fillStyle = '#ffffff';
  miniCtx.beginPath(); miniCtx.moveTo(5, 0); miniCtx.lineTo(-4, -3.5); miniCtx.lineTo(-4, 3.5);
  miniCtx.closePath(); miniCtx.fill();
  miniCtx.restore();
}

/* ---------------- HUD ---------------- */
function updateHUD() {
  shownMoney += (player.money - shownMoney) * 0.12;
  if (Math.abs(shownMoney - player.money) < 1) shownMoney = player.money;
  ui.money.textContent = fmt$(shownMoney);
  ui.healthFill.style.width = clamp(player.hp, 0, 100) + '%';
  const s = stars();
  for (let i = 0; i < 5; i++) ui.stars[i].classList.toggle('on', i < s);
  ui.starsWrap.classList.toggle('hot', s > 0);
  ui.recTime.textContent = fmtTime(gameTime);
  if (player.veh && !player.dead) {
    ui.speedo.classList.remove('hidden');
    ui.speedoVal.textContent = Math.round(player.veh.speed * 0.35);
  } else ui.speedo.classList.add('hidden');
}

/* ---------------- pause ---------------- */
function togglePause(force) {
  if (state !== 'run') return;
  paused = force === undefined ? !paused : force;
  $('overlay-pause').classList.toggle('hidden', !paused);
}

/* ---------------- input events ---------------- */
window.addEventListener('keydown', e => {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
  if (e.repeat) return;
  keys.add(e.code);
  if (e.code === 'Escape') togglePause();
  if (state !== 'run' || paused) return;
  if (e.code === 'KeyV') toggleCine();
  if (e.code === 'KeyM') { AUD.setMute(!AUD.muted); ui.mute.textContent = AUD.muted ? '🔇' : '🔊'; }
  if (e.code === 'KeyH') hornAction();
  if (e.code === 'KeyE' && !demoMode && !player.dead) {
    if (player.veh) exitVehicle();
    else { const v = nearestEnterableVehicle(); if (v) enterVehicle(v); }
  }
});
window.addEventListener('keyup', e => keys.delete(e.code));
canvas.addEventListener('mousemove', e => { mouse.x = e.clientX; mouse.y = e.clientY; });
canvas.addEventListener('mousedown', e => { if (e.button === 0) mouse.down = true; });
window.addEventListener('mouseup', () => { mouse.down = false; });
canvas.addEventListener('contextmenu', e => e.preventDefault());

/* ---------------- UI wiring ---------------- */
function initUI() {
  ui.money = $('hud-money');
  ui.healthFill = $('hud-health-fill');
  ui.starsWrap = $('hud-stars');
  ui.stars = Array.from(document.querySelectorAll('#hud-stars .star'));
  ui.recTime = $('rec-time');
  ui.speedo = $('speedo');
  ui.speedoVal = $('speedo-val');
  ui.mute = $('btn-mute');

  $('btn-start').addEventListener('click', () => startSession(false));
  $('btn-demo').addEventListener('click', () => startSession(true));
  $('btn-resume').addEventListener('click', () => togglePause(false));
  $('btn-restart').addEventListener('click', () => { worldReady = false; startSession(false); });
  $('btn-demo2').addEventListener('click', () => startSession(true));
  $('btn-cam').addEventListener('click', toggleCine);
  $('btn-horn').addEventListener('click', hornAction);
  $('btn-mute').addEventListener('click', () => {
    AUD.setMute(!AUD.muted);
    ui.mute.textContent = AUD.muted ? '🔇' : '🔊';
  });
  $('btn-replay').addEventListener('click', () => {
    replayOpen = !replayOpen;
    $('replay-panel').classList.toggle('open', replayOpen);
    if (replayOpen) renderReplayList();
  });
  $('btn-replay-close').addEventListener('click', () => {
    replayOpen = false;
    $('replay-panel').classList.remove('open');
  });
  $('btn-save-replay').addEventListener('click', saveReplayJSON);
  $('btn-pause').addEventListener('click', () => togglePause());
  $('btn-skip-demo').addEventListener('click', () => {
    AP.stop();
    demoMode = false;
    $('demo-banner').classList.add('hidden');
    FEEL.emit('takeControl');
    toast('You have the wheel. WASD to drive, E to exit, SPACE to drift.');
  });
}

/* ---------------- main loop ---------------- */
let lastT = performance.now();
function frame(now) {
  const dt = Math.min(1 / 30, (now - lastT) / 1000);
  lastT = now;
  if (state === 'run' && !paused) update(dt);
  if (state === 'run') render();
  requestAnimationFrame(frame);
}

initUI();
requestAnimationFrame(frame);
