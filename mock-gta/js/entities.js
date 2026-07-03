'use strict';
/* ================= entities: player, vehicles, peds, bullets, particles ================= */
let vehicles = [], peds = [], bullets = [], particles = [], skids = [];
let player = null;

function mkPlayer(x, y) {
  return {
    x, y, a: 0, vx: 0, vy: 0, hp: 100, money: 250,
    veh: null, dead: false, deadT: 0, deadReason: '',
    shootCd: 0, aimA: 0, walkPhase: 0,
  };
}

/* =========================== VEHICLE =========================== */
class Vehicle {
  constructor(x, y, a, type, role) {
    this.x = x; this.y = y; this.a = a;
    this.type = type; this.spec = CARS[type];
    this.color = choice(this.spec.colors);
    this.vx = 0; this.vy = 0;
    this.role = role;                       // player | cop | traffic | parked | leaving | wreck
    this.hp = this.spec.hp;
    this.len = type === 'van' ? 52 : 46; this.wid = 22; this.r = 16;
    this.dir = 0; this.lastTk = -1; this.speedWish = rand(110, 150);
    this.stuckT = 0; this.revT = 0;
    this.siren = false; this.flash = 0;
    this.braking = false; this.drifting = false;
    this.wreck = false; this.wreckT = 0; this.smokeT = 0;
    this.dmgCd = 0; this.shootCd = rand(0.5, 1.4);
    this.field = null; this.destX = 0; this.destY = 0;
    this.pedCd = 0;
  }
  get speed() { return Math.hypot(this.vx, this.vy); }

  physStep(dt, c) {
    const fx = Math.cos(this.a), fy = Math.sin(this.a);
    let vf = this.vx * fx + this.vy * fy;
    let vl = -this.vx * fy + this.vy * fx;
    const sp = this.spec;
    this.braking = false;
    if (c.up) vf += sp.acc * dt * (vf < 0 ? 2.2 : 1);
    if (c.down) {
      if (vf > 5) { vf -= 520 * dt; this.braking = true; }
      else vf -= sp.acc * 0.55 * dt;
    }
    vf = clamp(vf, -150, sp.maxS);
    vf *= Math.exp(-0.35 * dt);
    const grip = c.hb ? 1.7 : 7.5;
    vl *= Math.exp(-grip * dt);
    if (c.hb) { vf *= Math.exp(-0.55 * dt); this.braking = true; }
    const sgn = vf < -5 ? -1 : 1;
    const sf = clamp(Math.abs(vf) / 140, 0, 1);
    const steer = (c.left ? -1 : 0) + (c.right ? 1 : 0);
    this.a += steer * sp.turn * sf * sgn * dt;
    this.vx = fx * vf - fy * vl;
    this.vy = fy * vf + fx * vl;

    this.drifting = Math.abs(vl) > 85 && this.speed > 150;
    if (this.drifting) {
      const bx = -fx * 16, by = -fy * 16;
      pushSkid(this.x + bx - fy * 8, this.y + by + fx * 8, this.x + bx - fy * 8 - this.vx * dt, this.y + by + fx * 8 - this.vy * dt);
      pushSkid(this.x + bx + fy * 8, this.y + by - fx * 8, this.x + bx + fy * 8 - this.vx * dt, this.y + by - fx * 8 - this.vy * dt);
      if (this.role === 'player') { stats.driftTime += dt; FEEL.emit('drift'); }
    }
    this.moveCollide(dt);
  }

  moveCollide(dt) {
    const nx = this.x + this.vx * dt;
    if (circleHitsSolid(nx, this.y, this.r)) { this.hitWall(Math.abs(this.vx)); this.vx *= -0.32; }
    else this.x = nx;
    const ny = this.y + this.vy * dt;
    if (circleHitsSolid(this.x, ny, this.r)) { this.hitWall(Math.abs(this.vy)); this.vy *= -0.32; }
    else this.y = ny;
    this.x = clamp(this.x, TILE + 20, WORLDW - TILE - 20);
    this.y = clamp(this.y, TILE + 20, WORLDH - TILE - 20);
  }

  hitWall(v) {
    if (v < 130 || this.dmgCd > 0) return;
    this.dmgCd = 0.4;
    this.hp -= v * 0.055;
    spawnSparks(this.x, this.y, 6);
    AUD.crash(v / 600);
    if (this.role === 'player') { addShake(clamp(v / 60, 2, 9)); FEEL.emit('crash'); }
  }

  update(dt) {
    this.dmgCd -= dt; this.pedCd -= dt;
    if (this.role === 'player' && demoMode) this.hp = Math.max(this.hp, 30);  // autopilot's ride survives the show
    if (this.wreck) {
      this.wreckT -= dt;
      this.smokeT -= dt;
      if (this.smokeT <= 0) {
        this.smokeT = 0.12;
        spawnParticle('smoke', this.x + rand(-8, 8), this.y + rand(-8, 8), rand(-6, 6), rand(-22, -10), rand(1, 1.8), 8, '#555');
        if (this.wreckT > 20) spawnParticle('flame', this.x + rand(-10, 10), this.y + rand(-6, 6), rand(-4, 4), rand(-30, -12), rand(0.3, 0.6), 7, '#ff8830');
      }
      return;
    }
    if (this.role === 'player') {
      this.physStep(dt, currentDriveControls());
      this.checkPedHits(true);
      this.checkPropHits(true);
      this.checkNearMiss();
      if (this.role === 'player') stats.topSpeed = Math.max(stats.topSpeed, this.speed);
    } else if (this.role === 'cop') {
      this.flash += dt;
      const c = driveTowards(this, player ? hunterTargetX() : this.x, player ? hunterTargetY() : this.y, dt, false);
      this.physStep(dt, c);
      this.checkPedHits(false);
      this.checkPropHits(false);
    } else if (this.role === 'leaving') {
      const c = driveTowards(this, this.destX, this.destY, dt, false);
      this.physStep(dt, c);
      this.leaveT = (this.leaveT || 0) + dt;
      if (this.leaveT > 9 || dist2(this.x, this.y, cam.x, cam.y) > 1600 * 1600) this.dead = true;
    } else if (this.role === 'traffic') {
      this.updateTraffic(dt);
    } else { // parked
      if (this.speed > 3) {
        this.physStep(dt, { up: false, down: false, left: false, right: false, hb: false });
        this.checkPedHits(false);
        this.checkPropHits(false);
      } else { this.vx = 0; this.vy = 0; }
    }
    if (this.hp <= 0 && !this.wreck) this.explode();
  }

  updateTraffic(dt) {
    const d = DIRS[this.dir];
    const ax = this.x + d.dx * 58, ay = this.y + d.dy * 58;
    let block = false;
    for (const o of vehicles) {
      if (o !== this && dist2(o.x, o.y, ax, ay) < 40 * 40) { block = true; break; }
    }
    if (!block) for (const p of peds) {
      if (!p.down && dist2(p.x, p.y, ax, ay) < 28 * 28) { block = true; break; }
    }
    if (!block && player && !player.veh && !player.dead && dist2(player.x, player.y, ax, ay) < 34 * 34) block = true;
    const want = block ? 0 : this.speedWish;
    const cur = this.speed * Math.sign((this.vx * d.dx + this.vy * d.dy) || 1);
    const ns = clamp(cur + clamp(want - cur, -420 * dt, 150 * dt), 0, 200);
    this.braking = block && cur > 40;

    if (d.dx !== 0) {
      const gy = Math.floor(this.y / (12 * TILE));
      const targetY = tileCx(gy * 12 + (d.dx > 0 ? 1 : 0));
      this.y += clamp(targetY - this.y, -70 * dt, 70 * dt);
    } else {
      const gx = Math.floor(this.x / (12 * TILE));
      const targetX = tileCx(gx * 12 + (d.dy > 0 ? 0 : 1));
      this.x += clamp(targetX - this.x, -70 * dt, 70 * dt);
    }
    this.x += d.dx * ns * dt;
    this.y += d.dy * ns * dt;
    this.vx = d.dx * ns; this.vy = d.dy * ns;
    this.a += angDiff(this.a, d.a) * Math.min(1, 8 * dt);

    const tk = px2tile(this.x) + px2tile(this.y) * MAPW;
    if (tk !== this.lastTk) { this.lastTk = tk; this.decideDir(); }
    if (circleHitsSolid(this.x, this.y, 8)) {  // safety: never inside walls
      const n = findNearestRoadTile(this.x, this.y);
      this.x = tileCx(n.tx); this.y = tileCx(n.ty);
    }
  }

  decideDir() {
    const tx = px2tile(this.x), ty = px2tile(this.y);
    const opts = [];
    for (let i = 0; i < 4; i++) {
      if (i === (this.dir + 2) % 4) continue;
      const d = DIRS[i];
      if (isRoadT(tx + d.dx * 2, ty + d.dy * 2) && isRoadT(tx + d.dx, ty + d.dy)) opts.push(i);
    }
    if (opts.length === 0) { this.dir = (this.dir + 2) % 4; return; }
    if (opts.includes(this.dir) && Math.random() < 0.72) return;
    this.dir = choice(opts);
  }

  checkPedHits(byPlayer) {
    if (this.speed < 95 || this.pedCd > 0) return;
    for (const p of peds) {
      if (p.down) continue;
      if (dist2(p.x, p.y, this.x, this.y) < 21 * 21) {
        p.hitByCar(this, byPlayer);
        this.pedCd = 0.25;
        break;
      }
    }
  }

  checkPropHits(byPlayer) {
    if (this.speed < 85) return;
    for (const pr of props) {
      if (pr.broken) continue;
      if (dist2(pr.x, pr.y, this.x, this.y) < 19 * 19) smashProp(pr, this, byPlayer);
    }
  }

  checkNearMiss() {
    if (this.speed < 230) return;
    for (const p of peds) {
      if (p.down || p.nearCd > 0) continue;
      const d2 = dist2(p.x, p.y, this.x, this.y);
      if (d2 > 24 * 24 && d2 < 42 * 42) {
        p.nearCd = 4; p.flee(this.x, this.y);
        stats.nearMisses++;
        FEEL.emit('nearMiss');
      }
    }
  }

  explode() {
    this.wreck = true; this.wreckT = 26;
    this.role = 'wreck';
    spawnExplosion(this.x, this.y);
    const wasCopCar = this.type === 'police';
    for (const v of vehicles) {
      if (v !== this && !v.wreck && dist2(v.x, v.y, this.x, this.y) < 85 * 85) v.hp -= 70;
    }
    for (const p of peds) {
      if (dist2(p.x, p.y, this.x, this.y) < 90 * 90) { p.hp -= 60; p.knockDown(this.x, this.y); }
    }
    if (player && !player.dead) {
      if (player.veh === this) { player.hp = 0; }
      else if (!player.veh && dist2(player.x, player.y, this.x, this.y) < 90 * 90) { player.hp -= 65; addShake(14); }
    }
    if (player && player.veh === this) player.veh = null;
    if (wasCopCar) addHeat(1.6);
    FEEL.emit('explosion');
  }

  draw(g, night) {
    g.save();
    g.translate(this.x, this.y);
    g.rotate(this.a);
    const L = this.len, W = this.wid;
    // shadow
    g.fillStyle = 'rgba(0,0,0,0.3)';
    g.beginPath(); g.ellipse(2, 4, L / 2, W / 2 + 2, 0, 0, TAU); g.fill();
    if (this.wreck) {
      g.fillStyle = '#232323';
      roundRectPath(g, -L / 2, -W / 2, L, W, 6); g.fill();
      g.fillStyle = '#161616'; g.fillRect(-L / 6, -W / 2 + 3, L / 3, W - 6);
      g.restore();
      return;
    }
    // tyres
    g.fillStyle = '#14151a';
    g.fillRect(-L / 2 + 6, -W / 2 - 2, 9, 4); g.fillRect(-L / 2 + 6, W / 2 - 2, 9, 4);
    g.fillRect(L / 2 - 15, -W / 2 - 2, 9, 4); g.fillRect(L / 2 - 15, W / 2 - 2, 9, 4);
    // body
    g.fillStyle = this.color;
    roundRectPath(g, -L / 2, -W / 2, L, W, 7); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.14)';
    g.fillRect(-L / 2 + 4, -W / 2 + 2, L - 8, 4);
    // windshield + rear window
    g.fillStyle = '#1d2733';
    g.fillRect(L / 8, -W / 2 + 3, L / 5, W - 6);
    g.fillRect(-L / 2 + 7, -W / 2 + 3, L / 8, W - 6);
    // roof
    g.fillStyle = shadeColor(this.color, this.type === 'taxi' ? 0 : -18);
    g.fillRect(-L / 2 + 13, -W / 2 + 3, L / 2 - 8, W - 6);
    if (this.type === 'taxi') {
      g.fillStyle = '#222'; g.fillRect(-6, -5, 12, 10);
      g.fillStyle = '#ffd23f'; g.fillRect(-4, -3, 8, 6);
    }
    if (this.type === 'sports') {
      g.fillStyle = shadeColor(this.color, -30);
      g.fillRect(-L / 2 + 2, -W / 2 + 2, 5, W - 4); // spoiler
    }
    if (this.type === 'police') {
      g.fillStyle = '#1a1e26';
      g.fillRect(-L / 2 + 13, -W / 2 + 3, L / 2 - 8, W - 6);
      const on = this.siren && (this.flash % 0.5 < 0.25);
      g.fillStyle = on ? '#ff4040' : '#701818'; g.fillRect(-4, -7, 8, 6);
      g.fillStyle = !on ? '#4060ff' : '#182270'; g.fillRect(-4, 1, 8, 6);
    }
    // headlights / taillights
    g.fillStyle = night ? '#fff7c0' : '#d8d8b0';
    g.fillRect(L / 2 - 3, -W / 2 + 2, 3, 5); g.fillRect(L / 2 - 3, W / 2 - 7, 3, 5);
    g.fillStyle = this.braking ? '#ff3030' : '#7a1616';
    g.fillRect(-L / 2, -W / 2 + 2, 3, 5); g.fillRect(-L / 2, W / 2 - 7, 3, 5);
    g.restore();
  }
}

function roundRectPath(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

function shadeColor(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const r = clamp((n >> 16) + amt, 0, 255), gg = clamp(((n >> 8) & 255) + amt, 0, 255), b = clamp((n & 255) + amt, 0, 255);
  return 'rgb(' + r + ',' + gg + ',' + b + ')';
}

/* ---- shared "GPS" driving controller (cops + autopilot) ---- */
function driveTowards(v, destX, destY, dt, pro) {
  let gx = destX, gy = destY;
  const tx = px2tile(v.x), ty = px2tile(v.y);
  if (v.field && dist2(v.x, v.y, destX, destY) > 190 * 190) {
    const s1 = fieldStep(v.field, tx, ty);
    if (s1) {
      const s2 = fieldStep(v.field, s1.tx, s1.ty) || s1;
      gx = tileCx(s2.tx); gy = tileCx(s2.ty);
    }
  }
  const ta = Math.atan2(gy - v.y, gx - v.x);
  const ad = angDiff(v.a, ta);
  const sharp = Math.abs(ad);
  const sp = v.speed;
  const c = { up: false, down: false, left: ad < -0.06, right: ad > 0.06, hb: false };
  if (sharp < 1.0) c.up = true;
  else if (sharp < 1.9) { c.up = sp < 170; c.down = sp > 310; }
  else { c.down = sp > 90; c.up = sp <= 90; }
  if (pro && sharp > 0.9 && sp > 240) { c.hb = true; c.up = true; c.down = false; }
  if (sp < 18) v.stuckT += dt; else v.stuckT = 0;
  if (v.revT > 0) {
    v.revT -= dt;
    return { up: false, down: true, left: ad > 0, right: ad < 0, hb: false };
  }
  if (v.stuckT > 1.4) { v.revT = 0.75; v.stuckT = 0; }
  return c;
}

function hunterTargetX() { return player.veh ? player.veh.x : player.x; }
function hunterTargetY() { return player.veh ? player.veh.y : player.y; }

/* ---- vehicle pair collisions ---- */
function collideVehicles() {
  for (let i = 0; i < vehicles.length; i++) {
    const a = vehicles[i];
    for (let j = i + 1; j < vehicles.length; j++) {
      const b = vehicles[j];
      const d2 = dist2(a.x, a.y, b.x, b.y);
      if (d2 > 30 * 30 || d2 === 0) continue;
      const d = Math.sqrt(d2), nx = (b.x - a.x) / d, ny = (b.y - a.y) / d;
      const overlap = 30 - d;
      if (!a.wreck) { a.x -= nx * overlap / 2; a.y -= ny * overlap / 2; }
      if (!b.wreck) { b.x += nx * overlap / 2; b.y += ny * overlap / 2; }
      const rvx = b.vx - a.vx, rvy = b.vy - a.vy;
      const rel = rvx * nx + rvy * ny;
      if (rel < 0) {
        const imp = rel * 0.55;
        if (!a.wreck) { a.vx += nx * imp; a.vy += ny * imp; }
        if (!b.wreck) { b.vx -= nx * imp; b.vy -= ny * imp; }
        const force = Math.abs(rel);
        if (force > 130) {
          const dmg = force * 0.05;
          a.hp -= dmg; b.hp -= dmg;
          spawnSparks((a.x + b.x) / 2, (a.y + b.y) / 2, 8);
          AUD.crash(force / 600);
          const pl = (player && (player.veh === a || player.veh === b));
          if (pl) { addShake(clamp(force / 55, 3, 11)); FEEL.emit('crash'); }
          if (pl && (a.type === 'police' || b.type === 'police')) addHeat(0.8);
          for (const t of [a, b]) {
            if (t.role === 'traffic' && force > 150) { t.role = 'parked'; spawnBailingDriver(t); }
          }
        }
      }
    }
  }
}

function spawnBailingDriver(v) {
  const p = new Ped(v.x + rand(-14, 14), v.y + rand(-14, 14), false);
  p.flee(v.x, v.y);
  peds.push(p);
}

/* =========================== PED =========================== */
class Ped {
  constructor(x, y, cop) {
    this.x = x; this.y = y; this.a = rand(0, TAU);
    this.cop = !!cop;
    this.hp = cop ? 55 : 30;
    this.down = false; this.downT = 0; this.dead = false; this.fade = 1;
    this.state = 'walk'; this.fleeT = 0; this.fleeX = 0; this.fleeY = 0;
    this.walkT = 0; this.speed = cop ? 148 : rand(32, 52);
    this.shirt = cop ? '#26365c' : choice(PED_SHIRTS);
    this.skin = choice(PED_SKINS);
    this.step = rand(0, TAU); this.nearCd = 0; this.gone = false;
  }

  flee(fx, fy) { this.state = 'flee'; this.fleeT = rand(2.5, 4); this.fleeX = fx; this.fleeY = fy; }

  knockDown(fx, fy) {
    if (this.down) return;
    this.down = true;
    this.downT = this.hp <= 0 ? 999 : rand(4, 6.5);
    if (this.hp <= 0) this.dead = true;
    const d = Math.max(12, dist(fx, fy, this.x, this.y));
    this.x += (this.x - fx) / d * 16; this.y += (this.y - fy) / d * 16;
    spawnParticle('puff', this.x, this.y, 0, -14, 0.5, 9, '#c9c2b8');
  }

  hitByCar(v, byPlayer) {
    this.hp -= v.speed * 0.22;
    this.knockDown(v.x, v.y);
    AUD.crash(0.15);
    if (byPlayer) {
      addHeat(this.cop ? 1.4 : (this.dead ? 1.5 : 1.0));
      FEEL.emit(this.cop ? 'hitCop' : 'hitPed');
    }
  }

  shot(byPlayer) {
    this.hp -= 16;
    spawnParticle('puff', this.x, this.y, rand(-10, 10), rand(-16, -6), 0.4, 7, '#d8d0c4');
    if (this.hp <= 0) { this.dead = true; this.knockDown(this.x + rand(-4, 4), this.y + rand(-4, 4)); this.downT = 999; }
    else this.flee(player ? player.x : this.x, player ? player.y : this.y);
    if (byPlayer) addHeat(this.cop ? 1.3 : (this.dead ? 1.4 : 0.9));
  }

  update(dt) {
    this.nearCd -= dt;
    this.step += dt * 9;
    if (this.down) {
      this.downT -= dt;
      if (this.dead) { this.fade -= dt / 11; if (this.fade <= 0) this.gone = true; }
      else if (this.downT <= 0) { this.down = false; this.flee(this.x + rand(-9, 9), this.y + rand(-9, 9)); }
      return;
    }
    if (this.cop) { this.updateCop(dt); return; }
    let mvx = 0, mvy = 0;
    if (this.state === 'flee') {
      this.fleeT -= dt;
      if (this.fleeT <= 0) this.state = 'walk';
      const d = Math.max(10, dist(this.fleeX, this.fleeY, this.x, this.y));
      mvx = (this.x - this.fleeX) / d * 118;
      mvy = (this.y - this.fleeY) / d * 118;
      this.a = Math.atan2(mvy, mvx);
    } else {
      this.walkT -= dt;
      if (this.walkT <= 0) {
        this.walkT = rand(2, 6);
        const opts = [];
        for (const dd of DIRS) {
          const t = tileAt(px2tile(this.x) + dd.dx, px2tile(this.y) + dd.dy);
          if (t === T.SIDE) opts.push(dd.a);
          else if (t !== T.BUILD && t !== T.ROAD) opts.push(dd.a);
        }
        this.a = opts.length ? choice(opts) + rand(-0.2, 0.2) : this.a + Math.PI;
      }
      mvx = Math.cos(this.a) * this.speed;
      mvy = Math.sin(this.a) * this.speed;
    }
    this.moveCollide(mvx, mvy, dt);
  }

  updateCop(dt) {
    if (!player || player.dead) return;
    if (stars() === 0) { this.gone = true; return; }
    if (player.veh) {
      if (dist2(player.veh.x, player.veh.y, this.x, this.y) > 620 * 620) this.gone = true;
      const a = Math.atan2(player.veh.y - this.y, player.veh.x - this.x);
      this.a = a;
      this.moveCollide(Math.cos(a) * 60, Math.sin(a) * 60, dt);
      return;
    }
    const d = dist(player.x, player.y, this.x, this.y);
    const a = Math.atan2(player.y - this.y, player.x - this.x);
    this.a = a;
    this.moveCollide(Math.cos(a) * this.speed, Math.sin(a) * this.speed, dt);
    if (d < 20) busted();
  }

  moveCollide(mvx, mvy, dt) {
    const nx = this.x + mvx * dt;
    if (!circleHitsSolid(nx, this.y, 7)) this.x = nx; else this.walkT = 0;
    const ny = this.y + mvy * dt;
    if (!circleHitsSolid(this.x, ny, 7)) this.y = ny; else this.walkT = 0;
  }

  draw(g) {
    g.save();
    g.translate(this.x, this.y);
    g.globalAlpha = this.fade;
    if (this.down) {
      g.rotate(this.a + Math.PI / 2);
      g.fillStyle = 'rgba(0,0,0,0.25)';
      g.beginPath(); g.ellipse(1, 2, 10, 5, 0, 0, TAU); g.fill();
      g.fillStyle = this.shirt;
      g.beginPath(); g.ellipse(0, 0, 9, 4.5, 0, 0, TAU); g.fill();
      g.fillStyle = this.skin;
      g.beginPath(); g.arc(8, 0, 3.4, 0, TAU); g.fill();
      g.restore();
      return;
    }
    g.rotate(this.a);
    const bob = Math.sin(this.step) * 1.4;
    g.fillStyle = 'rgba(0,0,0,0.3)';
    g.beginPath(); g.ellipse(1, 2, 7, 5.5, 0, 0, TAU); g.fill();
    g.fillStyle = this.shirt;
    g.beginPath(); g.ellipse(bob * 0.2, 0, 6.2, 5, 0, 0, TAU); g.fill();
    g.fillStyle = this.skin;
    g.beginPath(); g.arc(1.5, 0, 3.4, 0, TAU); g.fill();
    if (this.cop) { g.fillStyle = '#1b2a4d'; g.beginPath(); g.arc(1.5, 0, 3.0, 0, TAU); g.fill(); }
    g.restore();
  }
}

/* =========================== bullets =========================== */
class Bullet {
  constructor(x, y, a, fromCop) {
    this.x = x; this.y = y;
    this.vx = Math.cos(a) * 820; this.vy = Math.sin(a) * 820;
    this.life = 0.8; this.fromCop = fromCop; this.dead = false;
  }
  update(dt) {
    for (let s = 0; s < 2 && !this.dead; s++) {
      const h = dt / 2;
      this.x += this.vx * h; this.y += this.vy * h;
      if (solidAt(this.x, this.y)) { spawnSparks(this.x, this.y, 3); this.dead = true; return; }
      for (const p of peds) {
        if (!p.down && dist2(p.x, p.y, this.x, this.y) < 10 * 10) {
          p.shot(!this.fromCop); this.dead = true; return;
        }
      }
      for (const v of vehicles) {
        if (!v.wreck && dist2(v.x, v.y, this.x, this.y) < 15 * 15) {
          if (this.fromCop && player && player.veh === v) {
            v.hp -= 4; player.hp -= 3;
          } else if (!this.fromCop) {
            v.hp -= 7;
            if (v.type === 'police') addHeat(0.35);
          } else v.hp -= 2;
          spawnSparks(this.x, this.y, 4);
          this.dead = true; return;
        }
      }
      if (this.fromCop && player && !player.dead && !player.veh &&
          dist2(player.x, player.y, this.x, this.y) < 10 * 10) {
        player.hp -= 9; addShake(5); this.dead = true; return;
      }
    }
    this.life -= dt;
    if (this.life <= 0) this.dead = true;
  }
  draw(g) {
    g.strokeStyle = this.fromCop ? '#9fc4ff' : '#ffe9a0';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(this.x, this.y);
    g.lineTo(this.x - this.vx * 0.012, this.y - this.vy * 0.012);
    g.stroke();
  }
}

/* =========================== particles & skids =========================== */
function spawnParticle(type, x, y, vx, vy, life, size, col, txt) {
  if (particles.length > 420) particles.shift();
  particles.push({ type, x, y, vx, vy, life, max: life, size, col, txt });
}
function spawnSparks(x, y, n) {
  for (let i = 0; i < n; i++) {
    const a = rand(0, TAU), s = rand(60, 220);
    spawnParticle('spark', x, y, Math.cos(a) * s, Math.sin(a) * s, rand(0.15, 0.4), 2, '#ffcf6a');
  }
}
function spawnExplosion(x, y) {
  spawnParticle('flash', x, y, 0, 0, 0.18, 70, '#fff');
  spawnParticle('ring', x, y, 0, 0, 0.5, 10, '#ffb050');
  for (let i = 0; i < 22; i++) {
    const a = rand(0, TAU), s = rand(50, 260);
    spawnParticle('flame', x, y, Math.cos(a) * s, Math.sin(a) * s, rand(0.3, 0.8), rand(5, 11), choice(['#ff8830', '#ffb050', '#ff5525']));
  }
  for (let i = 0; i < 12; i++) {
    const a = rand(0, TAU), s = rand(20, 90);
    spawnParticle('smoke', x, y, Math.cos(a) * s, Math.sin(a) * s, rand(0.9, 1.9), rand(7, 13), '#484848');
  }
  AUD.boom(); addShake(20);
}
function spawnMoneyText(x, y, txt) {
  spawnParticle('text', x, y, 0, -34, 1.4, 17, '#7dff9a', txt);
}
function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dt;
    if (p.life <= 0) { particles.splice(i, 1); continue; }
    p.x += p.vx * dt; p.y += p.vy * dt;
    if (p.type === 'water') p.vy += 340 * dt;
    if (p.type === 'smoke') { p.vx *= 0.95; p.vy *= 0.95; }
  }
}
function drawParticles(g) {
  for (const p of particles) {
    const k = p.life / p.max;
    if (p.type === 'text') {
      g.globalAlpha = k;
      g.font = '700 ' + p.size + 'px Consolas, monospace';
      g.fillStyle = p.col;
      g.fillText(p.txt, p.x - 20, p.y);
      g.globalAlpha = 1;
      continue;
    }
    if (p.type === 'ring') {
      g.globalAlpha = k;
      g.strokeStyle = p.col; g.lineWidth = 4;
      g.beginPath(); g.arc(p.x, p.y, p.size + (1 - k) * 90, 0, TAU); g.stroke();
      g.globalAlpha = 1;
      continue;
    }
    g.globalAlpha = p.type === 'flash' ? k : k * 0.85;
    g.fillStyle = p.col;
    const s = p.type === 'smoke' ? p.size * (2 - k) : p.size * (p.type === 'flash' ? (2 - k) : 1);
    g.beginPath(); g.arc(p.x, p.y, s, 0, TAU); g.fill();
    g.globalAlpha = 1;
  }
}
function pushSkid(x1, y1, x2, y2) {
  if (skids.length > 700) skids.splice(0, 40);
  skids.push({ x1, y1, x2, y2, life: 12 });
}
function updateSkids(dt) {
  for (let i = skids.length - 1; i >= 0; i--) {
    skids[i].life -= dt;
    if (skids[i].life <= 0) skids.splice(i, 1);
  }
}
function drawSkids(g) {
  g.lineWidth = 4; g.lineCap = 'round';
  for (const s of skids) {
    g.strokeStyle = 'rgba(12,12,14,' + (0.4 * Math.min(1, s.life / 6)).toFixed(3) + ')';
    g.beginPath(); g.moveTo(s.x1, s.y1); g.lineTo(s.x2, s.y2); g.stroke();
  }
}

/* =========================== props =========================== */
function smashProp(pr, v, byPlayer) {
  pr.broken = true;
  pr.fallA = Math.atan2(v.vy, v.vx);
  AUD.crash(0.25);
  spawnSparks(pr.x, pr.y, 5);
  if (pr.kind === 'hydrant') {
    pr.waterT = 6;
    if (byPlayer) FEEL.emit('hydrant');
  }
  if (byPlayer) addHeat(0.4);
  v.hp -= 3;
}
function updateProps(dt) {
  for (const pr of props) {
    if (pr.kind === 'hydrant' && pr.broken && pr.waterT > 0) {
      pr.waterT -= dt;
      if (Math.random() < 0.6) {
        spawnParticle('water', pr.x + rand(-2, 2), pr.y, rand(-40, 40), rand(-260, -170), rand(0.5, 0.9), rand(2, 4), 'rgba(120,190,255,0.8)');
      }
    }
  }
}
function drawProp(g, pr) {
  g.save();
  g.translate(pr.x, pr.y);
  if (pr.kind === 'hydrant') {
    g.fillStyle = 'rgba(0,0,0,0.3)';
    g.beginPath(); g.ellipse(1, 2, 5, 4, 0, 0, TAU); g.fill();
    g.fillStyle = pr.broken ? '#7a2020' : '#d03030';
    g.beginPath(); g.arc(0, 0, 4.6, 0, TAU); g.fill();
    g.fillStyle = pr.broken ? '#5a1818' : '#a02020';
    g.fillRect(-5.5, -1.5, 11, 3);
  } else {
    if (pr.broken) {
      g.rotate(pr.fallA);
      g.fillStyle = '#3c414c'; g.fillRect(0, -2, 26, 4);
      g.fillStyle = '#c9c9a0'; g.beginPath(); g.arc(26, 0, 4, 0, TAU); g.fill();
    } else {
      g.fillStyle = 'rgba(0,0,0,0.3)';
      g.beginPath(); g.ellipse(1, 2, 4, 3, 0, 0, TAU); g.fill();
      g.fillStyle = '#4a505c'; g.beginPath(); g.arc(0, 0, 3.4, 0, TAU); g.fill();
      g.fillStyle = '#ffe9a0'; g.beginPath(); g.arc(0, 0, 1.8, 0, TAU); g.fill();
    }
  }
  g.restore();
}

/* =========================== pickups =========================== */
function updatePickups(dt) {
  for (const p of pickups) {
    p.phase += dt * 3;
    if (p.taken) {
      p.respT -= dt;
      if (p.respT <= 0) { relocatePickup(p); p.taken = false; }
      continue;
    }
    if (!player || player.dead) continue;
    const px = player.veh ? player.veh.x : player.x;
    const py = player.veh ? player.veh.y : player.y;
    if (dist2(px, py, p.x, p.y) < 26 * 26) {
      p.taken = true; p.respT = 25;
      if (p.kind === 'money') {
        const amt = 50;
        player.money += amt; stats.earned += amt;
        spawnMoneyText(p.x, p.y, '+$' + amt);
        AUD.blip(); FEEL.emit('money');
      } else {
        player.hp = Math.min(100, player.hp + 50);
        spawnMoneyText(p.x, p.y, '+HP');
        AUD.blip();
      }
    }
  }
}
function drawPickup(g, p) {
  if (p.taken) return;
  const bob = Math.sin(p.phase) * 2.5;
  g.save();
  g.translate(p.x, p.y + bob);
  if (p.kind === 'money') {
    g.fillStyle = 'rgba(60,255,140,0.25)';
    g.beginPath(); g.arc(0, 0, 12, 0, TAU); g.fill();
    g.fillStyle = '#3cff8c';
    g.font = '700 15px Consolas, monospace';
    g.fillText('$', -4, 5);
  } else {
    g.fillStyle = 'rgba(255,80,90,0.25)';
    g.beginPath(); g.arc(0, 0, 12, 0, TAU); g.fill();
    g.fillStyle = '#ff5a64';
    g.fillRect(-6, -2, 12, 4); g.fillRect(-2, -6, 4, 12);
  }
  g.restore();
}

/* =========================== player on foot + enter/exit =========================== */
function updatePlayerFoot(dt) {
  const c = currentFootControls();
  let mx = (c.right ? 1 : 0) - (c.left ? 1 : 0);
  let my = (c.down ? 1 : 0) - (c.up ? 1 : 0);
  const m = Math.hypot(mx, my);
  if (m > 0) { mx /= m; my /= m; }
  const spd = 168;
  player.vx = mx * spd; player.vy = my * spd;
  const nx = player.x + player.vx * dt;
  if (!circleHitsSolid(nx, player.y, 9)) player.x = nx;
  const ny = player.y + player.vy * dt;
  if (!circleHitsSolid(player.x, ny, 9)) player.y = ny;
  player.x = clamp(player.x, TILE + 12, WORLDW - TILE - 12);
  player.y = clamp(player.y, TILE + 12, WORLDH - TILE - 12);
  if (m > 0) { player.a = Math.atan2(my, mx); player.walkPhase += dt * 10; }
  else player.a = player.aimA;
}

function nearestEnterableVehicle() {
  let best = null, bestD = 46 * 46;
  for (const v of vehicles) {
    if (v.wreck || v.role === 'cop' || v.role === 'leaving') continue;
    const d2 = dist2(v.x, v.y, player.x, player.y);
    if (d2 < bestD) { bestD = d2; best = v; }
  }
  return best;
}

function enterVehicle(v) {
  if (!v || player.veh) return;
  if (v.role === 'traffic') {
    spawnBailingDriver(v);
    addHeat(0.8);
    FEEL.emit('carjack');
  } else {
    FEEL.emit(v.type === 'sports' ? 'enterSports' : 'enterCar');
  }
  v.role = 'player';
  player.veh = v;
}

function exitVehicle() {
  const v = player.veh;
  if (!v) return;
  const side = [{ dx: -Math.sin(v.a), dy: Math.cos(v.a) }, { dx: Math.sin(v.a), dy: -Math.cos(v.a) }];
  for (const s of side) {
    const ex = v.x + s.dx * 26, ey = v.y + s.dy * 26;
    if (!circleHitsSolid(ex, ey, 9)) { player.x = ex; player.y = ey; break; }
  }
  v.role = 'parked';
  player.veh = null;
}

function drawPlayerFoot(g) {
  g.save();
  g.translate(player.x, player.y);
  g.rotate(player.a);
  const bob = Math.sin(player.walkPhase) * 1.5;
  g.fillStyle = 'rgba(0,0,0,0.35)';
  g.beginPath(); g.ellipse(1, 2, 8, 6, 0, 0, TAU); g.fill();
  g.fillStyle = '#e8e8f0';                       // white jacket = our hero
  g.beginPath(); g.ellipse(bob * 0.2, 0, 6.8, 5.4, 0, 0, TAU); g.fill();
  g.fillStyle = '#2c3444';
  g.fillRect(-2, -5.4, 4, 10.8);                 // strap
  g.fillStyle = '#e8b48c';
  g.beginPath(); g.arc(2, 0, 3.6, 0, TAU); g.fill();
  g.fillStyle = '#20242e';
  g.fillRect(5, -1.2, 6, 2.4);                   // pistol
  g.restore();
}
