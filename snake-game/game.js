const GRID_SIZE = 20;
const TILE_COUNT = 20;

// Game state
let gameState = {
    snake: [{ x: 10, y: 10 }],
    food: { x: 15, y: 15 },
    direction: { x: 1, y: 0 },
    nextDirection: { x: 1, y: 0 },
    score: 0,
    highScore: localStorage.getItem('snakeHighScore') || 0,
    isRunning: false,
    isPaused: false,
    gameOver: false
};

// Canvas setup
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// UI elements
const scoreDisplay = document.getElementById('score');
const highScoreDisplay = document.getElementById('highScore');
const gameStatusDisplay = document.getElementById('gameStatus');
const startBtn = document.getElementById('startBtn');
const pauseBtn = document.getElementById('pauseBtn');
const resetBtn = document.getElementById('resetBtn');

// Game loop
let gameLoopId = null;
const GAME_SPEED = 100; // ms

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    highScoreDisplay.textContent = gameState.highScore;
    draw();
});

// Event listeners
startBtn.addEventListener('click', startGame);
pauseBtn.addEventListener('click', togglePause);
resetBtn.addEventListener('click', resetGame);
document.addEventListener('keydown', handleKeyPress);

function handleKeyPress(e) {
    const key = e.key.toLowerCase();
    
    // Direction controls
    if (key === 'arrowup' || key === 'w') {
        if (gameState.direction.y === 0) {
            gameState.nextDirection = { x: 0, y: -1 };
        }
        e.preventDefault();
    } else if (key === 'arrowdown' || key === 's') {
        if (gameState.direction.y === 0) {
            gameState.nextDirection = { x: 0, y: 1 };
        }
        e.preventDefault();
    } else if (key === 'arrowleft' || key === 'a') {
        if (gameState.direction.x === 0) {
            gameState.nextDirection = { x: -1, y: 0 };
        }
        e.preventDefault();
    } else if (key === 'arrowright' || key === 'd') {
        if (gameState.direction.x === 0) {
            gameState.nextDirection = { x: 1, y: 0 };
        }
        e.preventDefault();
    } else if (key === ' ') {
        if (gameState.isRunning) {
            togglePause();
        }
        e.preventDefault();
    }
}

function startGame() {
    if (!gameState.isRunning) {
        gameState.isRunning = true;
        gameState.isPaused = false;
        gameState.gameOver = false;
        gameState.direction = { x: 1, y: 0 };
        gameState.nextDirection = { x: 1, y: 0 };
        
        updateUI();
        startBtn.textContent = 'Game Running...';
        startBtn.disabled = true;
        pauseBtn.disabled = false;
        
        gameLoopId = setInterval(update, GAME_SPEED);
    }
}

function togglePause() {
    if (gameState.isRunning) {
        gameState.isPaused = !gameState.isPaused;
        pauseBtn.textContent = gameState.isPaused ? 'Resume' : 'Pause';
        updateUI();
    }
}

function resetGame() {
    clearInterval(gameLoopId);
    gameState = {
        snake: [{ x: 10, y: 10 }],
        food: { x: 15, y: 15 },
        direction: { x: 1, y: 0 },
        nextDirection: { x: 1, y: 0 },
        score: 0,
        highScore: gameState.highScore,
        isRunning: false,
        isPaused: false,
        gameOver: false
    };
    
    startBtn.textContent = 'Start Game';
    startBtn.disabled = false;
    pauseBtn.textContent = 'Pause';
    pauseBtn.disabled = true;
    
    scoreDisplay.textContent = '0';
    gameStatusDisplay.textContent = 'Ready to play!';
    draw();
}

function update() {
    if (gameState.isPaused) return;
    
    gameState.direction = gameState.nextDirection;
    
    const head = gameState.snake[0];
    const newHead = {
        x: head.x + gameState.direction.x,
        y: head.y + gameState.direction.y
    };
    
    // Check wall collision
    if (newHead.x < 0 || newHead.x >= TILE_COUNT || newHead.y < 0 || newHead.y >= TILE_COUNT) {
        endGame();
        return;
    }
    
    // Check self collision
    if (gameState.snake.some(segment => segment.x === newHead.x && segment.y === newHead.y)) {
        endGame();
        return;
    }
    
    gameState.snake.unshift(newHead);
    
    // Check food collision
    if (newHead.x === gameState.food.x && newHead.y === gameState.food.y) {
        gameState.score += 10;
        spawnFood();
    } else {
        gameState.snake.pop();
    }
    
    updateUI();
    draw();
}

function endGame() {
    clearInterval(gameLoopId);
    gameState.isRunning = false;
    gameState.gameOver = true;
    
    if (gameState.score > gameState.highScore) {
        gameState.highScore = gameState.score;
        localStorage.setItem('snakeHighScore', gameState.highScore);
        highScoreDisplay.textContent = gameState.highScore;
    }
    
    startBtn.textContent = 'Start Game';
    startBtn.disabled = false;
    pauseBtn.disabled = true;
    pauseBtn.textContent = 'Pause';
    
    gameStatusDisplay.textContent = `Game Over! Final Score: ${gameState.score}`;
    draw();
}

function spawnFood() {
    let newFood;
    let isOnSnake = true;
    
    while (isOnSnake) {
        newFood = {
            x: Math.floor(Math.random() * TILE_COUNT),
            y: Math.floor(Math.random() * TILE_COUNT)
        };
        isOnSnake = gameState.snake.some(segment => segment.x === newFood.x && segment.y === newFood.y);
    }
    
    gameState.food = newFood;
}

function updateUI() {
    scoreDisplay.textContent = gameState.score;
    
    if (gameState.isRunning && !gameState.gameOver) {
        gameStatusDisplay.textContent = gameState.isPaused ? '⏸ Paused' : '▶ Playing...';
    } else if (gameState.gameOver) {
        gameStatusDisplay.textContent = `Game Over! Final Score: ${gameState.score}`;
    }
}

function draw() {
    // Clear canvas
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw grid (light)
    ctx.strokeStyle = '#f0f0f0';
    ctx.lineWidth = 1;
    for (let i = 1; i < TILE_COUNT; i++) {
        const pos = (i * canvas.width) / TILE_COUNT;
        ctx.beginPath();
        ctx.moveTo(pos, 0);
        ctx.lineTo(pos, canvas.height);
        ctx.stroke();
        
        ctx.beginPath();
        ctx.moveTo(0, pos);
        ctx.lineTo(canvas.width, pos);
        ctx.stroke();
    }
    
    // Draw snake
    gameState.snake.forEach((segment, index) => {
        const x = (segment.x * canvas.width) / TILE_COUNT;
        const y = (segment.y * canvas.height) / TILE_COUNT;
        const size = (canvas.width / TILE_COUNT);
        const padding = 2;
        
        if (index === 0) {
            // Head - cute rounded
            ctx.fillStyle = '#ffaaa5';
            ctx.beginPath();
            ctx.roundRect(x + padding, y + padding, size - padding * 2, size - padding * 2, 4);
            ctx.fill();
            
            // Eyes
            ctx.fillStyle = '#fff';
            const eyeSize = 3;
            const eyeY = y + size * 0.35;
            ctx.beginPath();
            ctx.arc(x + size * 0.35, eyeY, eyeSize, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(x + size * 0.65, eyeY, eyeSize, 0, Math.PI * 2);
            ctx.fill();
            
            // Pupils
            ctx.fillStyle = '#ffaaa5';
            ctx.beginPath();
            ctx.arc(x + size * 0.35 + (gameState.direction.x * 1.5), eyeY + (gameState.direction.y * 1.5), 1.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(x + size * 0.65 + (gameState.direction.x * 1.5), eyeY + (gameState.direction.y * 1.5), 1.5, 0, Math.PI * 2);
            ctx.fill();
        } else {
            // Body - gradient segments
            const gradient = ctx.createLinearGradient(x, y, x + size, y + size);
            gradient.addColorStop(0, '#a8e6cf');
            gradient.addColorStop(1, '#88d9b0');
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.roundRect(x + padding, y + padding, size - padding * 2, size - padding * 2, 3);
            ctx.fill();
        }
    });
    
    // Draw food (apple)
    const fx = (gameState.food.x * canvas.width) / TILE_COUNT;
    const fy = (gameState.food.y * canvas.height) / TILE_COUNT;
    const fsize = (canvas.width / TILE_COUNT);
    const fpadding = 3;
    
    ctx.fillStyle = '#ffd3b6';
    ctx.beginPath();
    ctx.roundRect(fx + fpadding, fy + fpadding, fsize - fpadding * 2, fsize - fpadding * 2, 5);
    ctx.fill();
    
    // Apple shine
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.beginPath();
    ctx.arc(fx + fsize * 0.35, fy + fsize * 0.35, fsize * 0.25, 0, Math.PI * 2);
    ctx.fill();
    
    // Stem
    ctx.strokeStyle = '#a8e6cf';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(fx + fsize * 0.5, fy + fpadding);
    ctx.lineTo(fx + fsize * 0.5, fy - 4);
    ctx.stroke();
}

// Polyfill for roundRect if not available
if (!CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function(x, y, w, h, r) {
        if (w < 2 * r) r = w / 2;
        if (h < 2 * r) r = h / 2;
        this.beginPath();
        this.moveTo(x + r, y);
        this.arcTo(x + w, y, x + w, y + h, r);
        this.arcTo(x + w, y + h, x, y + h, r);
        this.arcTo(x, y + h, x, y, r);
        this.arcTo(x, y, x + w, y, r);
        this.closePath();
        return this;
    };
}
