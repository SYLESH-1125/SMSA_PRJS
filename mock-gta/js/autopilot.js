'use strict';
/* ================= PRO DEMO autopilot — plays the game like a pro ================= */
const AP = {
  active: false, acts: [], idx: 0, actT: 0,
  driveC: { up: false, down: false, left: false, right: false, hb: false },
  walkC: { up: false, down: false, left: false, right: false },
  destX: 0, destY: 0, field: null, dtx: -1, dty: -1,
  car: null, sawMission: false, mDone: false, giverSet: false, cruiseDest: false,

  clearC() {
    this.driveC = { up: false, down: false, left: false, right: false, hb: false };
    this.walkC = { up: false, down: false, left: false, right: false };
  },

  start() {
    this.active = true; this.idx = 0; this.actT = 0;
    this.sawMission = false; this.mDone = false; this.giverSet = false; this.cruiseDest = false;
    this.field = null; this.dtx = -1; this.dty = -1;
    this.clearC();
    const car = new Vehicle(tileCx(42), tileCx(37), 0, 'sports', 'parked');
    car.color = '#ff8c1a';
    vehicles.push(car);
    this.car = car;
    pickups.push({ kind: 'money', x: tileCx(60), y: tileCx(37), phase: 0, taken: false, respT: 0, demo: true });
    this.acts = [
      { t: 'say', k: 'demoStart' },
      { t: 'walkTo', x: car.x, y: car.y + 24, to: 8 },
      { t: 'enter' },
      { t: 'say', k: 'demoRide' },
      { t: 'drive', tx: 66, ty: 37, to: 24 },
      { t: 'drive', tx: 73, ty: 60, to: 24 },
      { t: 'say', k: 'demoCrime' },
      { t: 'crime', tx: 50, ty: 42, to: 15 },
      { t: 'evade', tx: 13, ty: 84, to: 28 },
      { t: 'say', k: 'demoMission' },
      { t: 'mission', to: 115 },
      { t: 'say', k: 'demoDone' },
      { t: 'cruise' },
    ];
  },

  stop() {
    this.active = false;
    this.clearC();
  },

  recover() {
    if (!this.active) return;
    const rt = findNearestRoadTile(player.x, player.y);
    const car = new Vehicle(tileCx(rt.tx), tileCx(rt.ty), 0, 'sports', 'parked');
    vehicles.push(car);
    this.car = car;
    this.field = null; this.dtx = -1; this.dty = -1;
    this.acts = [
      { t: 'walkTo', x: car.x, y: car.y + 24, to: 10 },
      { t: 'enter' },
      { t: 'cruise' },
    ];
    this.idx = 0; this.actT = 0; this.cruiseDest = false;
    this.clearC();
  },

  setDest(tx, ty) {
    if (tx === this.dtx && ty === this.dty && this.field) return;
    this.dtx = tx; this.dty = ty;
    this.field = bfsField(tx, ty);
    this.destX = tileCx(tx); this.destY = tileCx(ty);
  },

  walkExec(x, y) {
    const dx = x - player.x, dy = y - player.y;
    this.walkC = { left: dx < -6, right: dx > 6, up: dy < -6, down: dy > 6 };
    return Math.hypot(dx, dy) < 16;
  },

  driveExec(dt) {
    const v = player.veh;
    if (!v) {
      const n = nearestEnterableVehicle();
      if (n) { if (this.walkExec(n.x, n.y)) enterVehicle(n); }
      else this.walkExec(this.destX, this.destY);
      return false;
    }
    v.field = this.field;
    this.driveC = driveTowards(v, this.destX, this.destY, dt, true);
    return dist2(v.x, v.y, this.destX, this.destY) < 75 * 75;
  },

  forceCrime() {
    let pr = null, bd = 1e18;
    for (const p of props) {
      if (p.kind !== 'hydrant') continue;
      const d2 = dist2(p.x, p.y, POI.demoHydrant.x, POI.demoHydrant.y);
      if (d2 < bd) { bd = d2; pr = p; }
    }
    if (pr && !pr.broken && player.veh) smashProp(pr, player.veh, true);
    if (heat < 1.2) addHeat(1.2);
    FEEL.emit('hydrant');
  },

  next() { this.idx++; this.actT = 0; this.clearC(); },

  update(dt) {
    if (!this.active || !player) return;
    if (player.dead) { this.clearC(); return; }
    const act = this.acts[this.idx];
    if (!act) { this.cruise(dt); return; }
    this.actT += dt;
    switch (act.t) {
      case 'say':
        FEEL.emit(act.k);
        if (act.k === 'demoDone') setDemoBanner('DEMO COMPLETE — city conquered. Take the wheel!');
        this.next();
        break;
      case 'walkTo':
        if (this.walkExec(act.x, act.y) || this.actT > act.to) this.next();
        break;
      case 'enter': {
        const v = nearestEnterableVehicle();
        if (v) enterVehicle(v);
        this.next();
        break;
      }
      case 'drive':
        this.setDest(act.tx, act.ty);
        if (this.driveExec(dt) || this.actT > act.to) this.next();
        break;
      case 'crime':
        this.setDest(act.tx, act.ty);
        this.driveExec(dt);
        if (heat >= 1) { this.next(); break; }
        if (this.actT > act.to || dist2(player.veh ? player.veh.x : player.x, player.veh ? player.veh.y : player.y, POI.demoHydrant.x, POI.demoHydrant.y) < 42 * 42) {
          if (heat < 1) this.forceCrime();
          this.next();
        }
        break;
      case 'evade':
        this.setDest(act.tx, act.ty);
        this.driveExec(dt);
        if (stars() === 0 && heat <= 0.01) { FEEL.emit('demoEvade'); this.next(); break; }
        if (this.actT > act.to) {
          heat = 0; prevStars = 0;
          FEEL.emit('evaded');
          this.next();
        }
        break;
      case 'mission':
        if (this.mDone) { this.next(); break; }
        if (!this.giverSet) { missionIdx = 1; giverCd = 0; this.giverSet = true; }
        if (mission) {
          this.sawMission = true;
          const tgt = mission.target;
          if (tgt) this.setDest(clamp(px2tile(tgt.x), 1, MAPW - 2), clamp(px2tile(tgt.y), 1, MAPH - 2));
        } else if (this.sawMission) {
          this.mDone = true; this.next(); break;
        } else {
          this.setDest(px2tile(POI.giver.x), px2tile(POI.giver.y));
        }
        this.driveExec(dt);
        if (this.actT > act.to && mission) mission.forcePass();
        break;
      case 'cruise':
        this.cruise(dt);
        break;
    }
  },

  cruise(dt) {
    if (!this.cruiseDest || dist2(player.veh ? player.veh.x : player.x, player.veh ? player.veh.y : player.y, this.destX, this.destY) < 90 * 90) {
      const tx = randi(1, 6) * 12 + 1, ty = randi(1, 6) * 12 + 1;
      this.setDest(tx, ty);
      this.cruiseDest = true;
    }
    this.driveExec(dt);
  },
};
