'use strict';
/* ================= wanted system, missions, feelings recorder ================= */
let heat = 0, prevStars = 0, lastCrimeT = -99;
let copField = null, copFieldCd = 0, copSpawnCd = 0;
let gameTime = 0, demoMode = false, cinematic = false;
let stats = { topSpeed: 0, driftTime: 0, starsPeak: 0, missions: 0, nearMisses: 0, earned: 0 };
let rec = [];

function stars() { return Math.floor(heat + 1e-6); }

function addHeat(n) {
  heat = clamp(heat + n, 0, 5);
  if (demoMode) heat = Math.min(heat, 2.4);   // pro demo: chase drama, no gunfire death spiral
  lastCrimeT = gameTime;
  const s = stars();
  stats.starsPeak = Math.max(stats.starsPeak, s);
  if (s > prevStars) {
    if (prevStars === 0) FEEL.emit('star1');
    else if (s >= 3) FEEL.emit('star3');
    else FEEL.emit('starUp');
  }
  prevStars = s;
}

function updateWanted(dt) {
  const s = stars();
  const px = player.veh ? player.veh.x : player.x;
  const py = player.veh ? player.veh.y : player.y;

  let copCars = 0, footCops = 0, nearestCop = 1e9;
  for (const v of vehicles) {
    if (v.role === 'cop') { copCars++; nearestCop = Math.min(nearestCop, dist(v.x, v.y, px, py)); }
  }
  for (const p of peds) if (p.cop && !p.down) footCops++;

  // decay when lying low
  if (heat > 0 && gameTime - lastCrimeT > (demoMode ? 4 : 7) && nearestCop > (demoMode ? 260 : 430)) {
    heat = Math.max(0, heat - dt * (demoMode ? 0.5 : 0.13) * (mission && mission.kind === 'getaway' ? 2.2 : 1));
    if (stars() < prevStars) {
      prevStars = stars();
      if (prevStars === 0) FEEL.emit('evaded');
    }
  }
  if (s > 0 && nearestCop < 500) FEEL.emit('evading');

  // spawn cop cars
  copSpawnCd -= dt;
  const desired = s === 0 ? 0 : clamp(s * 2, 1, 7);
  if (s > 0 && copCars < desired && copSpawnCd <= 0) {
    const rt = randomRoadTileNear(px, py, 620, 950);
    if (rt) {
      const v = new Vehicle(tileCx(rt.tx), tileCx(rt.ty), rand(0, TAU), 'police', 'cop');
      v.siren = true;
      vehicles.push(v);
      copSpawnCd = 1.6;
    }
  }
  // cops give up
  if (s === 0 && copCars > 0) {
    for (const v of vehicles) {
      if (v.role === 'cop') {
        v.role = 'leaving'; v.siren = false; v.field = null; v.leaveT = 0;
        const far = randomRoadTileNear(v.x, v.y, 900, 1400) || { tx: 3, ty: 3 };
        v.destX = tileCx(far.tx); v.destY = tileCx(far.ty);
      }
    }
  }

  // shared pursuit field
  copFieldCd -= dt;
  if (s > 0 && copFieldCd <= 0) {
    copFieldCd = 0.5;
    const rt = findNearestRoadTile(px, py);
    copField = bfsField(rt.tx, rt.ty);
    for (const v of vehicles) if (v.role === 'cop') v.field = copField;
  }

  // foot cops bail out near a stopped player
  if (s > 0 && !player.veh && !player.dead && footCops < Math.min(s, 3)) {
    for (const v of vehicles) {
      if (v.role === 'cop' && v.speed < 70 && dist2(v.x, v.y, px, py) < 150 * 150) {
        peds.push(new Ped(v.x + rand(-16, 16), v.y + rand(-16, 16), true));
        break;
      }
    }
  }

  // cop shooting at 3+ stars
  if (s >= 3) {
    for (const v of vehicles) {
      if (v.role !== 'cop') continue;
      v.shootCd -= dt;
      const d = dist(v.x, v.y, px, py);
      if (v.shootCd <= 0 && d < 420) {
        v.shootCd = rand(0.9, 1.5);
        const aim = Math.atan2(py - v.y, px - v.x) + rand(-0.12, 0.12);
        bullets.push(new Bullet(v.x + Math.cos(aim) * 20, v.y + Math.sin(aim) * 20, aim, true));
        AUD.shot();
      }
    }
  }
}

/* ---------------- busted / wasted ---------------- */
function busted() {
  if (!player || player.dead || heat <= 0) return;
  player.dead = true; player.deadT = 3.0; player.deadReason = 'busted';
  bigText('BUSTED', 'bad');
  AUD.sad(); FEEL.emit('busted');
  if (mission) failMission('The law caught up with you.');
}
function wasted() {
  if (!player || player.dead) return;
  player.dead = true; player.deadT = 3.0; player.deadReason = 'wasted';
  bigText('WASTED', 'bad');
  AUD.sad(); FEEL.emit('wasted');
  if (mission) failMission('You got wasted.');
}
function respawnPlayer() {
  const spot = player.deadReason === 'busted' ? POI.police : POI.hospital;
  if (player.veh) { player.veh.role = 'parked'; player.veh = null; }
  player.x = spot.x; player.y = spot.y;
  player.hp = 100; player.dead = false;
  player.money = Math.max(0, player.money - 150);
  heat = 0; prevStars = 0;
  toast(player.deadReason === 'busted' ? 'Released. Bail cost you $150.' : 'Patched up. Hospital bill: $150.');
  if (demoMode) AP.recover();
}

/* ================= missions ================= */
let mission = null, missionIdx = 0, giverCd = 0;

function updateMissions(dt) {
  if (mission) { mission.update(dt); refreshMissionPanel(); return; }
  giverCd -= dt;
  if (giverCd > 0 || !player || player.dead) return;
  const px = player.veh ? player.veh.x : player.x;
  const py = player.veh ? player.veh.y : player.y;
  if (dist2(px, py, POI.giver.x, POI.giver.y) < 36 * 36) startMission(missionIdx);
}

function startMission(i) {
  AUD.blip(); FEEL.emit('missionStart');
  if (i === 0) {
    let car = null, bd = 1e18;
    for (const v of vehicles) {
      if (v.type === 'sports' && !v.wreck && v.role === 'parked' && v !== player.veh) {
        const d2 = dist2(v.x, v.y, player.x, player.y);
        if (d2 < bd) { bd = d2; car = v; }
      }
    }
    if (!car) { missionIdx = 1; startMission(1); return; }
    mission = {
      kind: 'hotwheels', name: 'HOT WHEELS', reward: 500,
      phase: 'steal', car, timer: 75,
      get target() { return this.phase === 'steal' ? { x: this.car.x, y: this.car.y } : POI.garage; },
      obj() { return this.phase === 'steal' ? 'Steal the marked Cheetah' : 'Deliver it to the garage'; },
      update(dt) {
        this.timer -= dt;
        if (this.timer <= 0) { failMission('Out of time.'); return; }
        if (this.car.wreck) { failMission('You destroyed the merchandise!'); return; }
        if (this.phase === 'steal' && player.veh === this.car) { this.phase = 'deliver'; toast('Now bring it to the garage — clock is ticking! 🏁'); }
        if (this.phase === 'deliver' && player.veh === this.car && dist2(this.car.x, this.car.y, POI.garage.x, POI.garage.y) < 44 * 44) passMission();
      },
    };
  } else if (i === 1) {
    mission = {
      kind: 'pizza', name: 'PIZZA RUSH', reward: 350,
      stop: 0, timer: 30,
      get target() { return POI.pizza[this.stop]; },
      obj() { return 'Deliver pizza ' + (this.stop + 1) + '/3 — hit the marker'; },
      update(dt) {
        this.timer -= dt;
        if (this.timer <= 0) { failMission('Cold pizza. Refund issued.'); return; }
        const px = player.veh ? player.veh.x : player.x;
        const py = player.veh ? player.veh.y : player.y;
        if (dist2(px, py, this.target.x, this.target.y) < 40 * 40) {
          this.stop++;
          if (this.stop >= 3) { passMission(); return; }
          this.timer = 30;
          toast('Pizza delivered! 🍕 Next stop is on the minimap.');
          AUD.blip();
        }
      },
    };
  } else {
    mission = {
      kind: 'getaway', name: 'CLEAN GETAWAY', reward: 700,
      timer: 90, armed: false,
      get target() { return null; },
      obj() { return 'Lose ALL the heat before time runs out'; },
      update(dt) {
        if (!this.armed) { this.armed = true; addHeat(2.2); toast('You are HOT. Lose the cops! 🚨'); }
        this.timer -= dt;
        if (this.timer <= 0) { failMission('They never lost sight of you.'); return; }
        if (this.armed && stars() === 0 && gameTime - lastCrimeT > 3) passMission();
      },
    };
  }
  mission.forcePass = passMission;
  toast('MISSION: ' + mission.name);
  refreshMissionPanel();
}

function passMission() {
  if (!mission) return;
  const m = mission; mission = null;
  player.money += m.reward; stats.earned += m.reward; stats.missions++;
  bigText('MISSION PASSED!', 'good');
  spawnMoneyText(player.veh ? player.veh.x : player.x, (player.veh ? player.veh.y : player.y) - 20, '+$' + m.reward);
  AUD.jingle(); FEEL.emit('missionPass');
  missionIdx = (missionIdx + 1) % 3;
  giverCd = 6;
  refreshMissionPanel();
}
function failMission(why) {
  if (!mission) return;
  mission = null;
  bigText('MISSION FAILED', 'bad');
  toast(why);
  AUD.sad(); FEEL.emit('missionFail');
  giverCd = 5;
  refreshMissionPanel();
}

function refreshMissionPanel() {
  const panel = document.getElementById('mission-panel');
  if (!mission) { panel.classList.add('hidden'); return; }
  panel.classList.remove('hidden');
  document.getElementById('mission-title').textContent = mission.name;
  document.getElementById('mission-obj').textContent = mission.obj();
  const tEl = document.getElementById('mission-timer');
  tEl.textContent = '⏱ ' + Math.ceil(mission.timer) + 's';
  tEl.classList.toggle('low', mission.timer < 10);
}

/* ================= FEELINGS — realtime commentary + session recorder ================= */
const FEELINGS = {
  gameStart:  ["🌆|Terminal City... fresh air, questionable life choices. Let's move.", "🌆|New day, new hustle. This city is MINE."],
  demoStart:  ["🤖|PRO DEMO engaged — sit back, I'll show you how it's done.", "🤖|Autopilot on. Watch the hands, learn the craft."],
  enterCar:   ["🚗|Sweet ride. Let's see what she's got.", "🚗|Buckle up — zero to trouble in three seconds."],
  enterSports:["🏎️|A CHEETAH?! Oh, we are FLYING tonight.", "🏎️|This thing purrs. Heart rate: rising."],
  carjack:    ["😅|Sorry buddy — insurance will cover it!", "😬|Borrowing! It's called borrowing!"],
  drift:      ["🌀|That drift was BUTTER.", "🔥|Sliding through like it's nothing. Clean.", "🌀|Handbrake says hello. Tyres say goodbye."],
  highSpeed:  ["💨|Deep into the red — palms are SWEATY!", "💨|Full send. FULL. SEND.", "🚀|Streetlights turning into laser beams."],
  nearMiss:   ["😱|WOAH — nearly clipped that guy! Heart's in my throat.", "😅|Inches. INCHES. Sorry ma'am!"],
  crash:      ["💥|OKAY, that one hurt. The bumper is crying.", "💥|Who put that wall there?!", "🔧|That sound was expensive."],
  hitPed:     ["🤕|OH NO — somebody call a medic!", "😨|That's going to leave a mark. My bad. MY BAD."],
  hitCop:     ["🚔|I just bumped a COP. This day is escalating."],
  hydrant:    ["⛲|Free car wash! The city won't miss one hydrant.", "💦|Hydrant DOWN. Oops."],
  star1:      ["🚨|Heat on me. One star — stay frosty.", "🚨|Scanners picked me up. Time to move."],
  starUp:     ["🚨|More heat! They REALLY want me today.", "📈|Sirens multiplying. Adrenaline: maxed."],
  star3:      ["🚁|THREE stars?! They're shooting now — GO GO GO!"],
  evading:    ["🫣|Mirrors full of blue and red. Stay calm... stay FAST."],
  evaded:     ["🧊|Lost 'em. Ice. Cold. Breathing again.", "😮‍💨|Heat's gone. That chase took years off me."],
  missionStart:["📋|New job. Focus up — clock's ticking.", "📋|Contract accepted. Let's eat."],
  missionPass:["💰|PAYDAY BABY! Easy money.", "🏆|Passed it. Am I good or am I GOOD?"],
  missionFail:["😤|Blew it. Rage level: significant. Running it back."],
  money:      ["🤑|Cha-ching. Pockets getting heavy.", "💵|Found money is the best money."],
  wasted:     ["💀|WASTED... that's embarrassing. Hospital food again."],
  busted:     ["🚔|BUSTED. They got me. This is NOT over."],
  explosion:  ["🎆|BOOM!! Felt that one in my CHEST.", "💥|That car is modern art now."],
  nightfall:  ["🌙|Night city... headlights on. THIS is the vibe."],
  horn:       ["📯|BEEP BEEP. Coming through!"],
  takeControl:["🎮|Your city now — show me something."],
  demoRide:   ["🤖|Watch this line through downtown. Pro hands only."],
  demoCrime:  ["🤖|Let's poke the hornet's nest. Watch the heat rise..."],
  demoEvade:  ["🤖|And THIS is how you lose a tail. Textbook."],
  demoMission:["🤖|Time to get paid — mission run, optimal route."],
  demoDone:   ["🤖|Demo complete: money made, cops dusted, city conquered. Your turn."],
  idle:       ["🌇|This skyline never gets old.", "🎵|Radio's pure vibes right now.", "🍕|Something smells like pizza around here...", "🦉|Quiet block. Too quiet."],
};

const FEEL = {
  last: {}, feedEl: null, quietT: 0,
  emit(key) {
    const pool = FEELINGS[key];
    if (!pool) return;
    const now = gameTime;
    if (this.last[key] !== undefined && now - this.last[key] < 6) return;
    this.last[key] = now;
    const line = choice(pool);
    const bar = line.indexOf('|');
    this.push(line.slice(0, bar), line.slice(bar + 1));
  },
  push(emo, text) {
    rec.push({ t: +gameTime.toFixed(1), emo, text });
    if (rec.length > 400) rec.shift();
    this.quietT = 0;
    if (!this.feedEl) this.feedEl = document.getElementById('feed');
    const div = document.createElement('div');
    div.className = 'feed-item';
    const e = document.createElement('span'); e.className = 'fe'; e.textContent = emo;
    const t = document.createElement('span'); t.textContent = text;
    div.appendChild(e); div.appendChild(t);
    this.feedEl.appendChild(div);
    while (this.feedEl.children.length > 4) this.feedEl.removeChild(this.feedEl.firstChild);
    setTimeout(() => { div.classList.add('out'); setTimeout(() => div.remove(), 600); }, 6200);
    if (replayOpen) renderReplayList();
  },
  idle(dt) {
    this.quietT += dt;
    if (this.quietT > 22) { this.quietT = 0; this.emit('idle'); }
  },
};

/* ---------------- recorder panel ---------------- */
let replayOpen = false;
function renderReplayList() {
  const list = document.getElementById('replay-list');
  if (!rec.length) { list.innerHTML = '<div class="rp-empty">Nothing recorded yet — go make some memories.</div>'; return; }
  let html = '';
  for (const r of rec) {
    html += '<div class="rp-item"><span class="t">[' + fmtTime(r.t) + ']</span><span class="e">' + r.emo + '</span>' + escapeHtml(r.text) + '</div>';
  }
  list.innerHTML = html;
  list.scrollTop = list.scrollHeight;
}
function escapeHtml(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

function saveReplayJSON() {
  const data = {
    game: 'MOCK GTA — Terminal City',
    recordedAt: new Date().toISOString(),
    durationSec: +gameTime.toFixed(1),
    proDemo: demoMode,
    stats: {
      money: player ? player.money : 0,
      moneyEarned: stats.earned,
      missionsPassed: stats.missions,
      wantedStarsPeak: stats.starsPeak,
      topSpeedKmh: Math.round(stats.topSpeed * 0.35),
      driftTimeSec: +stats.driftTime.toFixed(1),
      nearMisses: stats.nearMisses,
    },
    feelings: rec,
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'mock-gta-session.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  toast('Session saved — every feeling, timestamped. 📼');
}

/* ---------------- toast + big center text ---------------- */
let toastTimer = null, bigTimer = null;
function toast(txt) {
  const el = document.getElementById('toast');
  el.textContent = txt;
  el.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add('hidden'), 3400);
}
function bigText(txt, cls) {
  const el = document.getElementById('bigtext');
  el.textContent = txt;
  el.className = cls || '';
  clearTimeout(bigTimer);
  bigTimer = setTimeout(() => el.classList.add('hidden'), 2600);
}
