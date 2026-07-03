const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Game constants
const ROWS = 20;
const COLS = 10;
const BLOCK_SIZE = canvas.width / COLS;

// Tetromino shapes (in rotations)
const TETROMINOES = {
    I: { rotations: [[0, 0], [1, 0], [2, 0], [3, 0]], color: '#00ffcc' },
    O: { rotations: [[0, 0], [1, 0], [0, 1], [1, 1]], color: '#ffcc00' },
    T: { rotations: [[1, 0], [0, 1], [1, 1], [2, 1]], color: '#ff66ff' },
    S: { rotations: [[1, 0], [2, 0], [0, 1], [1, 1]], color: '#ff6b9d' },
    Z: { rotations: [[0, 0], [1, 0], [1, 1], [2, 1]], color: '#c44569' },
    L: { rotations: [[0, 0], [0, 1], [1, 1], [2, 1]], color: '#ffa500' },
    J: { rotations: [[2, 0], [0, 1], [1, 1], [2, 1]], color: '#4ecdc4' }
};

// Game state
let board = Array(ROWS).fill(null).map(() => Array(COLS).fill(0));
let currentPiece = null;
let nextPieceType = null;
let score = 0;
let lines = 0;
let level = 1;
let gameRunning = false;
let gamePaused = false;
let dropCounter = 0;
let dropInterval = 1000;

// UI elements
const scoreDisplay = document.getElementById('score');
const levelDisplay = document.getElementById('level');
const linesDisplay = document.getElementById('lines');
const startBtn = document.getElementById('startBtn');
const pauseBtn = document.getElementById('pauseBtn');
const gameStatus = document.getElementById('gameStatus');

// Piece class
class Piece {
    constructor(type, x, y, rotation = 0) {
        this.type = type;
        this.x = x;
        this.y = y;
        this.rotation = rotation;
        this.color = TETROMINOES[type].color;
    }

    getBlocks() {
        const blocks = TETROMINOES[this.type].rotations;
        return blocks.map(([dx, dy]) => [this.x + dx, this.y + dy]);
    }

    rotate() {
        const maxRotation = TETROMINOES[this.type].rotations.length;
        this.rotation = (this.rotation + 1) % maxRotation;
    }
}

// Initialize piece
function getRandomPiece() {
    const types = Object.keys(TETROMINOES);
    const type = types[Math.floor(Math.random() * types.length)];
    return new Piece(type, 3, 0);
}

// Collision detection
function checkCollision(piece, offsetX = 0, offsetY = 0) {
    const blocks = piece.getBlocks();
    for (const [x, y] of blocks) {
        const newX = x + offsetX;
        const newY = y + offsetY;
        if (newX < 0 || newX >= COLS || newY >= ROWS) return true;
        if (newY >= 0 && board[newY][newX] !== 0) return true;
    }
    return false;
}

// Place piece on board
function placePiece(piece) {
    const blocks = piece.getBlocks();
    for (const [x, y] of blocks) {
        if (y >= 0) {
            board[y][x] = piece.color;
        }
    }
}

// Check and clear lines
function clearLines() {
    let linesCleared = 0;
    for (let row = ROWS - 1; row >= 0; row--) {
        if (board[row].every(cell => cell !== 0)) {
            board.splice(row, 1);
            board.unshift(Array(COLS).fill(0));
            linesCleared++;
        }
    }
    if (linesCleared > 0) {
        lines += linesCleared;
        score += linesCleared * 100 * level;
        level = Math.floor(lines / 10) + 1;
        dropInterval = Math.max(100, 1000 - (level - 1) * 50);
        updateDisplay();
    }
}

// Update display
function updateDisplay() {
    scoreDisplay.textContent = score;
    levelDisplay.textContent = level;
    linesDisplay.textContent = lines;
}

// Draw board
function drawBoard() {
    ctx.fillStyle = '#0a1628';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw grid
    ctx.strokeStyle = 'rgba(0, 217, 255, 0.1)';
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= COLS; i++) {
        ctx.beginPath();
        ctx.moveTo(i * BLOCK_SIZE, 0);
        ctx.lineTo(i * BLOCK_SIZE, canvas.height);
        ctx.stroke();
    }
    for (let i = 0; i <= ROWS; i++) {
        ctx.beginPath();
        ctx.moveTo(0, i * BLOCK_SIZE);
        ctx.lineTo(canvas.width, i * BLOCK_SIZE);
        ctx.stroke();
    }
    
    // Draw placed pieces
    for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
            if (board[y][x] !== 0) {
                ctx.fillStyle = board[y][x];
                ctx.fillRect(x * BLOCK_SIZE + 1, y * BLOCK_SIZE + 1, BLOCK_SIZE - 2, BLOCK_SIZE - 2);
            }
        }
    }
}

// Draw current piece
function drawPiece(piece) {
    ctx.fillStyle = piece.color;
    const blocks = piece.getBlocks();
    for (const [x, y] of blocks) {
        if (y >= 0) {
            ctx.fillRect(x * BLOCK_SIZE + 1, y * BLOCK_SIZE + 1, BLOCK_SIZE - 2, BLOCK_SIZE - 2);
        }
    }
}

// Keyboard events
document.addEventListener('keydown', (e) => {
    if (!gameRunning || gamePaused) return;
    
    switch (e.key) {
        case 'ArrowLeft':
            if (!checkCollision(currentPiece, -1, 0)) currentPiece.x--;
            e.preventDefault();
            break;
        case 'ArrowRight':
            if (!checkCollision(currentPiece, 1, 0)) currentPiece.x++;
            e.preventDefault();
            break;
        case 'ArrowDown':
            if (!checkCollision(currentPiece, 0, 1)) currentPiece.y++;
            e.preventDefault();
            break;
        case ' ':
        case 'ArrowUp':
            currentPiece.rotate();
            if (checkCollision(currentPiece, 0, 0)) currentPiece.rotate(); // Undo if collision
            e.preventDefault();
            break;
    }
});

// Start game
function startGame() {
    board = Array(ROWS).fill(null).map(() => Array(COLS).fill(0));
    score = 0;
    lines = 0;
    level = 1;
    dropInterval = 1000;
    gameRunning = true;
    gamePaused = false;
    
    currentPiece = getRandomPiece();
    startBtn.disabled = true;
    pauseBtn.disabled = false;
    gameStatus.textContent = '';
    updateDisplay();
    gameLoop();
}

// Pause game
pauseBtn.addEventListener('click', () => {
    if (gameRunning) {
        gamePaused = !gamePaused;
        pauseBtn.textContent = gamePaused ? 'Resume' : 'Pause';
        if (!gamePaused) gameLoop();
    }
});

// Start button
startBtn.addEventListener('click', startGame);

// Game loop
let lastDropTime = Date.now();
function gameLoop() {
    if (!gameRunning || gamePaused) return;
    
    const now = Date.now();
    dropCounter += now - lastDropTime;
    lastDropTime = now;
    
    // Auto drop piece
    if (dropCounter > dropInterval) {
        dropCounter = 0;
        if (!checkCollision(currentPiece, 0, 1)) {
            currentPiece.y++;
        } else {
            // Place piece and check for game over
            if (currentPiece.y <= 0) {
                gameRunning = false;
                gamePaused = false;
                gameStatus.textContent = 'Game Over! Click Start to retry.';
                startBtn.disabled = false;
                pauseBtn.disabled = true;
                return;
            }
            placePiece(currentPiece);
            clearLines();
            currentPiece = getRandomPiece();
        }
    }
    
    // Render
    drawBoard();
    if (currentPiece) drawPiece(currentPiece);
    
    requestAnimationFrame(gameLoop);
}

// Initial draw
drawBoard();
