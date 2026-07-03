(() => {
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;

  // HUD elements
  const scoreEl = document.getElementById('score');
  const healthEl = document.getElementById('health');
  const startBtn = document.getElementById('startBtn');
  const pauseBtn = document.getElementById('pauseBtn');
  const restartBtn = document.getElementById('restartBtn');

  let keys = {};
  let running = false;
  let paused = false;
  let score = 0;
  let health = 100;

  // Game entities
  const player = { x: 100, y: H-70, w: 36, h: 48, vx:0, vy:0, speed:3.2, onGround:false };
  const bullets = [];
  const enemies = [];
  const coins = [];

  const gravity = 0.9;

  function spawnEnemy(x=700,y=H-80){
    enemies.push({ x, y, w:36, h:36, vx:-1.6 - Math.random()*1.2, hp:20 });
  }
  function spawnCoin(x=400,y=H-120){
    coins.push({ x, y, r:10 });
  }

  function reset(){
    bullets.length = 0; enemies.length = 0; coins.length = 0; score = 0; health = 100;
    player.x = 100; player.y = H-70; player.vx=0; player.vy=0;
    updateHUD();
  }

  function updateHUD(){ scoreEl.textContent = score; healthEl.textContent = health; }

  function rectsCollide(a,b){
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function pointCircleCollide(px,py,cx,cy,r){
    const dx = px-cx, dy = py-cy; return dx*dx + dy*dy <= r*r;
  }

  function shoot(){
    bullets.push({ x: player.x + player.w, y: player.y + player.h/2, vx:8, w:8, h:4 });
  }

  function applyInput(){
    if (keys['ArrowLeft']){ player.vx = -player.speed; }
    else if (keys['ArrowRight']){ player.vx = player.speed; }
    else player.vx = 0;
    if ((keys['ArrowUp'] || keys['KeyW']) && player.onGround){ player.vy = -14; player.onGround = false; }
  }

  function updatePhysics(){
    // player physics
    player.vy += gravity;
    player.x += player.vx;
    player.y += player.vy;
    if (player.y + player.h >= H - 10){ player.y = H - 10 - player.h; player.vy = 0; player.onGround = true; }
    // clamp
    if (player.x < 0) player.x = 0; if (player.x + player.w > W) player.x = W - player.w;

    // bullets
    for (let i = bullets.length-1; i>=0; --i){
      const b = bullets[i]; b.x += b.vx; if (b.x > W) bullets.splice(i,1);
    }
    // enemies
    for (let i = enemies.length-1; i>=0; --i){
      const e = enemies[i]; e.x += e.vx; if (e.x + e.w < -50) enemies.splice(i,1);
      // collision with player
      if (rectsCollide(player,e)){
        enemies.splice(i,1); health -= 25; updateHUD(); if (health <=0) gameOver(); }
    }
    // bullets vs enemies
    for (let i = bullets.length-1; i>=0; --i){
      const b = bullets[i]; for (let j = enemies.length-1; j>=0; --j){ const e = enemies[j];
        if (rectsCollide(b,e)){
          e.hp -= 20; bullets.splice(i,1); if (e.hp <=0){ enemies.splice(j,1); score += 50; updateHUD(); }
          break;
        }
      }
    }
    // coins
    for (let i = coins.length-1; i>=0; --i){ const c = coins[i];
      if (pointCircleCollide(player.x+player.w/2, player.y+player.h/2, c.x, c.y, c.r)){
        coins.splice(i,1); score += 25; updateHUD(); }
    }
  }

  function draw(){
    // clear
    ctx.clearRect(0,0,W,H);
    // ground
    ctx.fillStyle = '#112233'; ctx.fillRect(0,H-10,W,10);
    // player
    ctx.fillStyle = '#ffd166'; ctx.fillRect(player.x, player.y, player.w, player.h);
    // bullets
    ctx.fillStyle = '#ffdd99'; bullets.forEach(b=> ctx.fillRect(b.x,b.y,b.w,b.h));
    // enemies
    ctx.fillStyle = '#ff6b6b'; enemies.forEach(e=> ctx.fillRect(e.x,e.y,e.w,e.h));
    // coins
    ctx.fillStyle = '#ffe066'; coins.forEach(c=>{
      ctx.beginPath(); ctx.arc(c.x,c.y,c.r,0,Math.PI*2); ctx.fill(); ctx.closePath();
    });
    // HUD in canvas corner
    ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.fillRect(8,8,140,44);
    ctx.fillStyle = '#fff'; ctx.font = '14px Arial'; ctx.fillText('Score: '+score,14,28); ctx.fillText('Health: '+health,14,44);
    if (!running){ ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(W/2-160,H/2-40,320,80); ctx.fillStyle = '#fff'; ctx.font='20px Arial'; ctx.fillText('Press Start to play', W/2-110, H/2);}    
  }

  function loop(){
    if (!running) return; if (paused){ requestAnimationFrame(loop); return }
    applyInput(); updatePhysics(); draw(); requestAnimationFrame(loop);
  }

  function gameOver(){ running = false; paused = false; ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(0,0,W,H);
    ctx.fillStyle='#fff'; ctx.font='30px Arial'; ctx.fillText('GAME OVER', W/2-90, H/2); ctx.font='18px Arial'; ctx.fillText('Press Restart to play again', W/2-140, H/2+30);
  }

  // input handlers
  window.addEventListener('keydown', (e)=>{ keys[e.code]=true;
    // demo helper keys
    if (e.code === 'Space'){ e.preventDefault(); shoot(); }
    if (e.code === 'KeyK'){ spawnEnemy(player.x + 300, H-80); }
    if (e.code === 'KeyC'){ spawnCoin(player.x + 200, H-120); }
    if (e.code === 'KeyP'){ paused = !paused; pauseBtn.textContent = paused? 'Resume':'Pause'; }
    if (e.code === 'KeyR'){ reset(); }
  });
  window.addEventListener('keyup', (e)=>{ keys[e.code]=false; });

  // button wiring
  startBtn.addEventListener('click', ()=>{
    if (!running){ running = true; paused = false; pauseBtn.textContent='Pause'; reset(); // initial demo spawns for demo visibility
      spawnEnemy(420, H-80); spawnCoin(350, H-120); requestAnimationFrame(loop); canvas.focus(); }
  });
  pauseBtn.addEventListener('click', ()=>{ paused = !paused; pauseBtn.textContent = paused? 'Resume':'Pause'; if (!running){ paused=false; } });
  restartBtn.addEventListener('click', ()=>{ reset(); running = true; paused=false; pauseBtn.textContent='Pause'; requestAnimationFrame(loop); });

  // make canvas focusable and click to focus
  canvas.addEventListener('click', ()=> canvas.focus());

  // initial draw
  draw();
})();