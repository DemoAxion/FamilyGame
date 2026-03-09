const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;
const NEXT_BLOCK = 24;

const COLORS = [
    null,
    '#0ff', // I - cyan
    '#00f', // J - blue
    '#f90', // L - orange
    '#ff0', // O - yellow
    '#0f0', // S - green
    '#a0f', // T - purple
    '#f00', // Z - red
];

// Tetromino shapes (each rotation state)
const PIECES = [
    null,
    // I
    [
        [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]],
        [[0,0,1,0],[0,0,1,0],[0,0,1,0],[0,0,1,0]],
        [[0,0,0,0],[0,0,0,0],[1,1,1,1],[0,0,0,0]],
        [[0,1,0,0],[0,1,0,0],[0,1,0,0],[0,1,0,0]],
    ],
    // J
    [
        [[2,0,0],[2,2,2],[0,0,0]],
        [[0,2,2],[0,2,0],[0,2,0]],
        [[0,0,0],[2,2,2],[0,0,2]],
        [[0,2,0],[0,2,0],[2,2,0]],
    ],
    // L
    [
        [[0,0,3],[3,3,3],[0,0,0]],
        [[0,3,0],[0,3,0],[0,3,3]],
        [[0,0,0],[3,3,3],[3,0,0]],
        [[3,3,0],[0,3,0],[0,3,0]],
    ],
    // O
    [
        [[4,4],[4,4]],
        [[4,4],[4,4]],
        [[4,4],[4,4]],
        [[4,4],[4,4]],
    ],
    // S
    [
        [[0,5,5],[5,5,0],[0,0,0]],
        [[0,5,0],[0,5,5],[0,0,5]],
        [[0,0,0],[0,5,5],[5,5,0]],
        [[5,0,0],[5,5,0],[0,5,0]],
    ],
    // T
    [
        [[0,6,0],[6,6,6],[0,0,0]],
        [[0,6,0],[0,6,6],[0,6,0]],
        [[0,0,0],[6,6,6],[0,6,0]],
        [[0,6,0],[6,6,0],[0,6,0]],
    ],
    // Z
    [
        [[7,7,0],[0,7,7],[0,0,0]],
        [[0,0,7],[0,7,7],[0,7,0]],
        [[0,0,0],[7,7,0],[0,7,7]],
        [[0,7,0],[7,7,0],[7,0,0]],
    ],
];

// Wall kick data (SRS)
const KICKS_JLSTZ = [
    [[0,0],[-1,0],[-1,1],[0,-2],[-1,-2]],
    [[0,0],[1,0],[1,-1],[0,2],[1,2]],
    [[0,0],[1,0],[1,1],[0,-2],[1,-2]],
    [[0,0],[-1,0],[-1,-1],[0,2],[-1,2]],
];
const KICKS_I = [
    [[0,0],[-2,0],[1,0],[-2,-1],[1,2]],
    [[0,0],[2,0],[-1,0],[2,1],[-1,-2]],
    [[0,0],[-1,0],[2,0],[-1,2],[2,-1]],
    [[0,0],[1,0],[-2,0],[1,-2],[-2,1]],
];

const POINTS = [0, 100, 300, 500, 800];
const LEVEL_LINES = 10;

let board, current, next, score, lines, level, gameOver, paused;
let dropInterval, dropTimer, lastTime;

function createBoard() {
    return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function randomPiece() {
    const id = Math.floor(Math.random() * 7) + 1;
    return { id, rotation: 0, x: Math.floor((COLS - PIECES[id][0][0].length) / 2), y: 0 };
}

function getShape(piece) {
    return PIECES[piece.id][piece.rotation];
}

function collides(piece, brd) {
    const shape = getShape(piece);
    for (let r = 0; r < shape.length; r++) {
        for (let c = 0; c < shape[r].length; c++) {
            if (!shape[r][c]) continue;
            const nx = piece.x + c;
            const ny = piece.y + r;
            if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
            if (ny >= 0 && brd[ny][nx]) return true;
        }
    }
    return false;
}

function lock(piece) {
    const shape = getShape(piece);
    for (let r = 0; r < shape.length; r++) {
        for (let c = 0; c < shape[r].length; c++) {
            if (!shape[r][c]) continue;
            const ny = piece.y + r;
            if (ny < 0) { triggerGameOver(); return; }
            board[ny][piece.x + c] = piece.id;
        }
    }
    clearLines();
}

function clearLines() {
    let cleared = 0;
    for (let r = ROWS - 1; r >= 0; r--) {
        if (board[r].every(cell => cell !== 0)) {
            board.splice(r, 1);
            board.unshift(new Array(COLS).fill(0));
            cleared++;
            r++; // recheck this row
        }
    }
    if (cleared > 0) {
        lines += cleared;
        score += POINTS[cleared] * level;
        level = Math.floor(lines / LEVEL_LINES) + 1;
        dropInterval = Math.max(50, 1000 - (level - 1) * 80);
        updateUI();
    }
}

function triggerGameOver() {
    gameOver = true;
    document.getElementById('final-score').textContent = 'Score: ' + score;
    document.getElementById('game-over-overlay').classList.add('active');
}

function updateUI() {
    document.getElementById('score').textContent = score;
    document.getElementById('level').textContent = level;
    document.getElementById('lines').textContent = lines;
}

function drawBlock(context, x, y, colorId, size) {
    const color = COLORS[colorId];
    context.fillStyle = color;
    context.fillRect(x * size, y * size, size, size);
    // Highlight
    context.fillStyle = 'rgba(255,255,255,0.15)';
    context.fillRect(x * size, y * size, size, 2);
    context.fillRect(x * size, y * size, 2, size);
    // Shadow
    context.fillStyle = 'rgba(0,0,0,0.3)';
    context.fillRect(x * size + size - 2, y * size, 2, size);
    context.fillRect(x * size, y * size + size - 2, size, 2);
    // Grid line
    context.strokeStyle = '#222';
    context.strokeRect(x * size, y * size, size, size);
}

function drawBoard() {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw grid
    ctx.strokeStyle = '#1a1a1a';
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            ctx.strokeRect(c * BLOCK, r * BLOCK, BLOCK, BLOCK);
        }
    }

    // Draw locked blocks
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            if (board[r][c]) {
                drawBlock(ctx, c, r, board[r][c], BLOCK);
            }
        }
    }

    // Draw ghost piece
    if (current) {
        const ghost = { ...current };
        while (!collides({ ...ghost, y: ghost.y + 1 }, board)) {
            ghost.y++;
        }
        const shape = getShape(ghost);
        ctx.globalAlpha = 0.2;
        for (let r = 0; r < shape.length; r++) {
            for (let c = 0; c < shape[r].length; c++) {
                if (shape[r][c]) {
                    drawBlock(ctx, ghost.x + c, ghost.y + r, ghost.id, BLOCK);
                }
            }
        }
        ctx.globalAlpha = 1;
    }

    // Draw current piece
    if (current) {
        const shape = getShape(current);
        for (let r = 0; r < shape.length; r++) {
            for (let c = 0; c < shape[r].length; c++) {
                if (shape[r][c] && current.y + r >= 0) {
                    drawBlock(ctx, current.x + c, current.y + r, current.id, BLOCK);
                }
            }
        }
    }
}

function drawNext() {
    nextCtx.fillStyle = '#000';
    nextCtx.fillRect(0, 0, nextCanvas.width, nextCanvas.height);

    if (!next) return;
    const shape = getShape(next);
    const offsetX = Math.floor((5 - shape[0].length) / 2);
    const offsetY = Math.floor((5 - shape.length) / 2);

    for (let r = 0; r < shape.length; r++) {
        for (let c = 0; c < shape[r].length; c++) {
            if (shape[r][c]) {
                drawBlock(nextCtx, c + offsetX, r + offsetY, next.id, NEXT_BLOCK);
            }
        }
    }
}

function tryRotate(dir) {
    const newRotation = (current.rotation + dir + 4) % 4;
    const kicks = current.id === 1 ? KICKS_I : KICKS_JLSTZ;
    const kickIndex = current.rotation;
    const tests = kicks[dir > 0 ? kickIndex : (kickIndex + 3) % 4];

    for (const [kx, ky] of tests) {
        const dx = dir > 0 ? kx : -kx;
        const dy = dir > 0 ? -ky : ky;
        const test = { ...current, rotation: newRotation, x: current.x + dx, y: current.y + dy };
        if (!collides(test, board)) {
            current.rotation = newRotation;
            current.x = test.x;
            current.y = test.y;
            return;
        }
    }
}

function drop() {
    const moved = { ...current, y: current.y + 1 };
    if (collides(moved, board)) {
        lock(current);
        if (gameOver) return;
        current = next;
        next = randomPiece();
        if (collides(current, board)) {
            triggerGameOver();
        }
        drawNext();
    } else {
        current.y++;
    }
}

function hardDrop() {
    let count = 0;
    while (!collides({ ...current, y: current.y + 1 }, board)) {
        current.y++;
        count++;
    }
    score += count * 2;
    updateUI();
    drop();
}

function handleKey(e) {
    if (gameOver) return;

    if (e.key === 'p' || e.key === 'P') {
        paused = !paused;
        if (!paused) lastTime = performance.now();
        return;
    }

    if (paused) return;

    switch (e.key) {
        case 'ArrowLeft': {
            const moved = { ...current, x: current.x - 1 };
            if (!collides(moved, board)) current.x--;
            break;
        }
        case 'ArrowRight': {
            const moved = { ...current, x: current.x + 1 };
            if (!collides(moved, board)) current.x++;
            break;
        }
        case 'ArrowDown':
            drop();
            score += 1;
            updateUI();
            break;
        case 'ArrowUp':
            tryRotate(1);
            break;
        case ' ':
            hardDrop();
            break;
    }

    e.preventDefault();
}

function gameLoop(time) {
    if (gameOver) return;
    requestAnimationFrame(gameLoop);

    if (paused) {
        // Draw pause text
        drawBoard();
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#0ff';
        ctx.font = '28px Courier New';
        ctx.textAlign = 'center';
        ctx.fillText('PAUSED', canvas.width / 2, canvas.height / 2);
        return;
    }

    const delta = time - lastTime;
    dropTimer += delta;
    lastTime = time;

    if (dropTimer > dropInterval) {
        drop();
        dropTimer = 0;
    }

    drawBoard();
}

function init() {
    board = createBoard();
    score = 0;
    lines = 0;
    level = 1;
    gameOver = false;
    paused = false;
    dropInterval = 1000;
    dropTimer = 0;
    lastTime = performance.now();

    current = randomPiece();
    next = randomPiece();

    updateUI();
    drawNext();
    document.getElementById('game-over-overlay').classList.remove('active');

    requestAnimationFrame(gameLoop);
}

document.addEventListener('keydown', handleKey);
document.getElementById('restart-btn').addEventListener('click', init);

init();