const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

// Tile size and map dimensions
const T = 20;
const COLS = 28;
const ROWS = 31;

// 0 = empty, 1 = wall, 2 = dot, 3 = power pellet, 4 = ghost house door
const MAP_DATA = [
    '1111111111111111111111111111',
    '1222222222222112222222222221',
    '1211112111112112111112111121',
    '1311112111112112111112111131',
    '1211112111112112111112111121',
    '1222222222222222222222222221',
    '1211112112111111112112111121',
    '1211112112111111112112111121',
    '1222222112222112222112222221',
    '1111112111110110111112111111',
    '0000012111110110111112100000',
    '0000012110000000001112100000',
    '0000012110111441110112100000',
    '1111112110100000010112111111',
    '0000002000100000010002000000',
    '1111112110100000010112111111',
    '0000012110111111110112100000',
    '0000012110000000001112100000',
    '0000012110111111110112100000',
    '1111112110111111110112111111',
    '1222222222222112222222222221',
    '1211112111112112111112111121',
    '1211112111112112111112111121',
    '1322112222222002222222112231',
    '1112112112111111112112112111',
    '1112112112111111112112112111',
    '1222222112222112222112222221',
    '1211111111112112111111111121',
    '1211111111112112111111111121',
    '1222222222222222222222222221',
    '1111111111111111111111111111',
];

let map = [];
let totalDots = 0;
let dotsEaten = 0;

function buildMap() {
    map = [];
    totalDots = 0;
    dotsEaten = 0;
    for (let r = 0; r < ROWS; r++) {
        map[r] = [];
        for (let c = 0; c < COLS; c++) {
            const val = parseInt(MAP_DATA[r][c]);
            map[r][c] = val;
            if (val === 2 || val === 3) totalDots++;
        }
    }
}

// Directions: 0=right, 1=down, 2=left, 3=up
const DX = [1, 0, -1, 0];
const DY = [0, 1, 0, -1];

// Game state
let score = 0;
let highScore = parseInt(localStorage.getItem('pacman-hi') || '0');
let lives = 3;
let level = 1;
let state = 'waiting'; // waiting, playing, dying, gameover, levelcomplete
let stateTimer = 0;

// Pac-Man
let pac = {};

function resetPac() {
    pac = {
        x: 14, y: 23, dir: 2, nextDir: 2,
        moveTimer: 0, moveSpeed: 14,
        mouthAngle: 0, mouthDir: 1,
        pixelX: 14 * T, pixelY: 23 * T,
        moving: false,
    };
}

// Ghosts
const GHOST_COLORS = ['#f00', '#ffb8ff', '#0ff', '#f90']; // Blinky, Pinky, Inky, Clyde
const GHOST_NAMES = ['blinky', 'pinky', 'inky', 'clyde'];
let ghosts = [];

const GHOST_START = [
    { x: 14, y: 11 }, // Blinky - starts outside
    { x: 13, y: 14 }, // Pinky - in house
    { x: 14, y: 14 }, // Inky - in house
    { x: 15, y: 14 }, // Clyde - in house
];

const GHOST_RELEASE_TIMERS = [0, 3000, 6000, 9000];

let frightened = false;
let frightenedTimer = 0;
const FRIGHTENED_DURATION = 7000;
let ghostsEatenCombo = 0;

function resetGhosts() {
    ghosts = [];
    for (let i = 0; i < 4; i++) {
        ghosts.push({
            x: GHOST_START[i].x,
            y: GHOST_START[i].y,
            pixelX: GHOST_START[i].x * T,
            pixelY: GHOST_START[i].y * T,
            dir: 3, // start moving up
            color: GHOST_COLORS[i],
            name: GHOST_NAMES[i],
            moveTimer: 0,
            moveSpeed: 16,
            mode: i === 0 ? 'scatter' : 'house',
            releaseTimer: GHOST_RELEASE_TIMERS[i],
            scatterTarget: null,
            eaten: false,
        });
    }
    // Scatter targets (corners)
    ghosts[0].scatterTarget = { x: 25, y: 0 };
    ghosts[1].scatterTarget = { x: 2, y: 0 };
    ghosts[2].scatterTarget = { x: 27, y: 30 };
    ghosts[3].scatterTarget = { x: 0, y: 30 };

    frightened = false;
    frightenedTimer = 0;
    ghostsEatenCombo = 0;
}

function isWalkable(x, y, isGhost) {
    // Tunnel wrap
    if (x < 0 || x >= COLS) return true;
    if (y < 0 || y >= ROWS) return false;
    const tile = map[y][x];
    if (tile === 1) return false;
    if (tile === 4 && !isGhost) return false;
    return true;
}

function wrapX(x) {
    if (x < 0) return COLS - 1;
    if (x >= COLS) return 0;
    return x;
}

function distance(x1, y1, x2, y2) {
    return Math.sqrt((x1 - x2) ** 2 + (y1 - y2) ** 2);
}

function getGhostTarget(ghost, index) {
    if (ghost.mode === 'scatter') return ghost.scatterTarget;
    if (ghost.mode === 'house') return { x: 14, y: 11 }; // exit point

    // Chase mode targets
    switch (index) {
        case 0: // Blinky: directly targets pac-man
            return { x: pac.x, y: pac.y };
        case 1: // Pinky: 4 tiles ahead of pac-man
            return { x: pac.x + DX[pac.dir] * 4, y: pac.y + DY[pac.dir] * 4 };
        case 2: // Inky: complex targeting using blinky's position
        {
            const ahead = { x: pac.x + DX[pac.dir] * 2, y: pac.y + DY[pac.dir] * 2 };
            return {
                x: ahead.x + (ahead.x - ghosts[0].x),
                y: ahead.y + (ahead.y - ghosts[0].y),
            };
        }
        case 3: // Clyde: targets pac-man if far, scatter if close
            if (distance(ghost.x, ghost.y, pac.x, pac.y) > 8) {
                return { x: pac.x, y: pac.y };
            }
            return ghost.scatterTarget;
        default:
            return { x: pac.x, y: pac.y };
    }
}

function moveGhost(ghost, index, dt) {
    if (ghost.eaten) {
        // Return to ghost house
        const target = { x: 14, y: 14 };
        if (ghost.x === target.x && ghost.y === target.y) {
            ghost.eaten = false;
            ghost.mode = 'chase';
            return;
        }
        ghost.moveSpeed = 4; // fast return
        moveGhostToward(ghost, target);
        ghost.moveSpeed = 10;
        return;
    }

    // Release from house
    if (ghost.mode === 'house') {
        ghost.releaseTimer -= dt;
        if (ghost.releaseTimer <= 0) {
            ghost.mode = 'scatter';
            ghost.x = 14;
            ghost.y = 11;
            ghost.pixelX = ghost.x * T;
            ghost.pixelY = ghost.y * T;
        }
        return;
    }

    const target = frightened ? null : getGhostTarget(ghost, index);

    if (frightened && !ghost.eaten) {
        // Random movement when frightened
        ghost.moveTimer += dt;
        if (ghost.moveTimer < ghost.moveSpeed * 20) return; // slower when frightened
        ghost.moveTimer = 0;

        const options = [];
        const reverse = (ghost.dir + 2) % 4;
        for (let d = 0; d < 4; d++) {
            if (d === reverse) continue;
            const nx = wrapX(ghost.x + DX[d]);
            const ny = ghost.y + DY[d];
            if (isWalkable(nx, ny, true)) {
                options.push(d);
            }
        }
        if (options.length > 0) {
            ghost.dir = options[Math.floor(Math.random() * options.length)];
        } else {
            ghost.dir = reverse;
        }
        ghost.x = wrapX(ghost.x + DX[ghost.dir]);
        ghost.y = ghost.y + DY[ghost.dir];
        ghost.pixelX = ghost.x * T;
        ghost.pixelY = ghost.y * T;
        return;
    }

    moveGhostToward(ghost, target);
}

function moveGhostToward(ghost, target) {
    ghost.moveTimer++;
    if (ghost.moveTimer < ghost.moveSpeed) return;
    ghost.moveTimer = 0;

    // Choose direction closest to target, no reversals
    let bestDir = ghost.dir;
    let bestDist = Infinity;
    const reverse = (ghost.dir + 2) % 4;

    // Priority: up, left, down, right
    const priority = [3, 2, 1, 0];
    for (const d of priority) {
        if (d === reverse) continue;
        const nx = wrapX(ghost.x + DX[d]);
        const ny = ghost.y + DY[d];
        if (!isWalkable(nx, ny, true)) continue;
        const dist = distance(nx, ny, target.x, target.y);
        if (dist < bestDist) {
            bestDist = dist;
            bestDir = d;
        }
    }

    // If no valid direction, reverse
    const nx = wrapX(ghost.x + DX[bestDir]);
    const ny = ghost.y + DY[bestDir];
    if (!isWalkable(nx, ny, true)) {
        bestDir = reverse;
    }

    ghost.dir = bestDir;
    ghost.x = wrapX(ghost.x + DX[ghost.dir]);
    ghost.y = ghost.y + DY[ghost.dir];
    ghost.pixelX = ghost.x * T;
    ghost.pixelY = ghost.y * T;
}

// Mode switching timer
let modeTimer = 0;
const MODE_SCHEDULE = [
    { mode: 'scatter', duration: 7000 },
    { mode: 'chase', duration: 20000 },
    { mode: 'scatter', duration: 7000 },
    { mode: 'chase', duration: 20000 },
    { mode: 'scatter', duration: 5000 },
    { mode: 'chase', duration: 20000 },
    { mode: 'scatter', duration: 5000 },
    { mode: 'chase', duration: Infinity },
];
let modeIndex = 0;

function updateModeTimer(dt) {
    if (frightened) return;
    modeTimer += dt;
    if (modeIndex < MODE_SCHEDULE.length && modeTimer >= MODE_SCHEDULE[modeIndex].duration) {
        modeTimer = 0;
        modeIndex++;
        if (modeIndex < MODE_SCHEDULE.length) {
            const newMode = MODE_SCHEDULE[modeIndex].mode;
            for (const g of ghosts) {
                if (g.mode !== 'house' && !g.eaten) {
                    g.mode = newMode;
                    // Reverse direction on mode switch
                    g.dir = (g.dir + 2) % 4;
                }
            }
        }
    }
}

function movePac(dt) {
    // Try next direction first
    const nextX = wrapX(pac.x + DX[pac.nextDir]);
    const nextY = pac.y + DY[pac.nextDir];
    if (isWalkable(nextX, nextY, false)) {
        pac.dir = pac.nextDir;
    }

    pac.moveTimer++;
    if (pac.moveTimer < pac.moveSpeed) return;
    pac.moveTimer = 0;

    const nx = wrapX(pac.x + DX[pac.dir]);
    const ny = pac.y + DY[pac.dir];

    if (isWalkable(nx, ny, false)) {
        pac.x = nx;
        pac.y = ny;
        pac.pixelX = pac.x * T;
        pac.pixelY = pac.y * T;
        pac.moving = true;

        // Eat dot
        if (map[pac.y] && (map[pac.y][pac.x] === 2 || map[pac.y][pac.x] === 3)) {
            const isPower = map[pac.y][pac.x] === 3;
            map[pac.y][pac.x] = 0;
            dotsEaten++;

            if (isPower) {
                score += 50;
                frightened = true;
                frightenedTimer = FRIGHTENED_DURATION;
                ghostsEatenCombo = 0;
                for (const g of ghosts) {
                    if (g.mode !== 'house' && !g.eaten) {
                        g.dir = (g.dir + 2) % 4;
                    }
                }
            } else {
                score += 10;
            }

            updateScore();

            if (dotsEaten >= totalDots) {
                state = 'levelcomplete';
                stateTimer = 2000;
            }
        }
    } else {
        pac.moving = false;
    }
}

function checkCollisions() {
    for (let i = 0; i < ghosts.length; i++) {
        const g = ghosts[i];
        if (g.mode === 'house' || g.eaten) continue;
        if (g.x === pac.x && g.y === pac.y) {
            if (frightened) {
                // Eat ghost
                g.eaten = true;
                ghostsEatenCombo++;
                score += 200 * Math.pow(2, ghostsEatenCombo - 1);
                updateScore();
            } else {
                // Pac-Man dies
                state = 'dying';
                stateTimer = 1500;
                return;
            }
        }
    }
}

function updateScore() {
    document.getElementById('score').textContent = score;
    if (score > highScore) {
        highScore = score;
        localStorage.setItem('pacman-hi', highScore);
        document.getElementById('high-score').textContent = highScore;
    }
}

function drawLives() {
    let str = '';
    for (let i = 0; i < lives; i++) str += '❤ ';
    document.getElementById('lives').textContent = str;
}

// Drawing
function drawMap() {
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            const tile = map[r][c];
            const x = c * T;
            const y = r * T;

            if (tile === 1) {
                ctx.fillStyle = '#1919a6';
                ctx.fillRect(x, y, T, T);
                // Draw borders for wall connectivity
                ctx.strokeStyle = '#3333ff';
                ctx.lineWidth = 1;

                const top = r > 0 && map[r - 1][c] === 1;
                const bot = r < ROWS - 1 && map[r + 1][c] === 1;
                const left = c > 0 && map[r][c - 1] === 1;
                const right = c < COLS - 1 && map[r][c + 1] === 1;

                if (!top) { ctx.beginPath(); ctx.moveTo(x, y + 0.5); ctx.lineTo(x + T, y + 0.5); ctx.stroke(); }
                if (!bot) { ctx.beginPath(); ctx.moveTo(x, y + T - 0.5); ctx.lineTo(x + T, y + T - 0.5); ctx.stroke(); }
                if (!left) { ctx.beginPath(); ctx.moveTo(x + 0.5, y); ctx.lineTo(x + 0.5, y + T); ctx.stroke(); }
                if (!right) { ctx.beginPath(); ctx.moveTo(x + T - 0.5, y); ctx.lineTo(x + T - 0.5, y + T); ctx.stroke(); }

            } else if (tile === 2) {
                ctx.fillStyle = '#ffb8ae';
                ctx.beginPath();
                ctx.arc(x + T / 2, y + T / 2, 2, 0, Math.PI * 2);
                ctx.fill();
            } else if (tile === 3) {
                ctx.fillStyle = '#ffb8ae';
                ctx.beginPath();
                ctx.arc(x + T / 2, y + T / 2, 6, 0, Math.PI * 2);
                ctx.fill();
            } else if (tile === 4) {
                ctx.fillStyle = '#ffb8ff';
                ctx.fillRect(x, y + T / 2 - 2, T, 4);
            }
        }
    }
}

function drawPacMan(time) {
    const cx = pac.pixelX + T / 2;
    const cy = pac.pixelY + T / 2;
    const radius = T / 2 - 1;

    // Animate mouth
    pac.mouthAngle += pac.mouthDir * 0.15;
    if (pac.mouthAngle > 0.8) pac.mouthDir = -1;
    if (pac.mouthAngle < 0.05) pac.mouthDir = 1;

    const mouth = pac.moving ? pac.mouthAngle : 0.2;
    const angle = [0, Math.PI / 2, Math.PI, -Math.PI / 2][pac.dir];

    ctx.fillStyle = '#ff0';
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, radius, angle + mouth, angle + Math.PI * 2 - mouth);
    ctx.closePath();
    ctx.fill();
}

function drawGhosts(time) {
    for (let i = 0; i < ghosts.length; i++) {
        const g = ghosts[i];
        const cx = g.pixelX + T / 2;
        const cy = g.pixelY + T / 2;
        const r = T / 2 - 1;

        let color;
        if (g.eaten) {
            // Just draw eyes
            drawGhostEyes(cx, cy, g.dir);
            continue;
        } else if (frightened && g.mode !== 'house') {
            color = frightenedTimer < 2000 && Math.floor(time / 200) % 2 ? '#fff' : '#2121de';
        } else {
            color = g.color;
        }

        // Ghost body
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(cx, cy - 2, r, Math.PI, 0);
        ctx.lineTo(cx + r, cy + r);

        // Wavy bottom
        const wave = 3;
        for (let w = r; w >= -r; w -= r / 2) {
            const wy = (w / (r / 2)) % 2 === 0 ? cy + r : cy + r - wave;
            ctx.lineTo(cx + w, wy);
        }

        ctx.closePath();
        ctx.fill();

        // Eyes (unless frightened)
        if (!frightened || g.mode === 'house') {
            drawGhostEyes(cx, cy, g.dir);
        } else {
            // Frightened face
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(cx - 3, cy - 3, 2, 0, Math.PI * 2);
            ctx.arc(cx + 3, cy - 3, 2, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}

function drawGhostEyes(cx, cy, dir) {
    const eyeOffX = DX[dir] * 2;
    const eyeOffY = DY[dir] * 2;

    // Eye whites
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.ellipse(cx - 4, cy - 3, 4, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx + 4, cy - 3, 4, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Pupils
    ctx.fillStyle = '#00f';
    ctx.beginPath();
    ctx.arc(cx - 4 + eyeOffX, cy - 3 + eyeOffY, 2, 0, Math.PI * 2);
    ctx.arc(cx + 4 + eyeOffX, cy - 3 + eyeOffY, 2, 0, Math.PI * 2);
    ctx.fill();
}

function drawDyingAnimation(progress) {
    const cx = pac.pixelX + T / 2;
    const cy = pac.pixelY + T / 2;
    const radius = T / 2 - 1;

    const mouth = Math.PI * progress;
    const angle = -Math.PI / 2;

    if (progress < 1) {
        ctx.fillStyle = '#ff0';
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, radius, angle + mouth, angle + Math.PI * 2 - mouth);
        ctx.closePath();
        ctx.fill();
    }
}

// Input
let inputDir = -1;

document.addEventListener('keydown', (e) => {
    switch (e.key) {
        case 'ArrowRight': inputDir = 0; break;
        case 'ArrowDown': inputDir = 1; break;
        case 'ArrowLeft': inputDir = 2; break;
        case 'ArrowUp': inputDir = 3; break;
        default: return;
    }
    e.preventDefault();

    if (state === 'waiting') {
        state = 'playing';
        document.getElementById('message').textContent = '';
    }
    if (state === 'gameover') {
        startGame();
    }
});

// Game loop
let lastTime = 0;

function update(time) {
    const dt = time - lastTime;
    lastTime = time;

    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    drawMap();

    if (state === 'playing') {
        if (inputDir >= 0) {
            pac.nextDir = inputDir;
        }

        movePac(dt);

        // Update frightened timer
        if (frightened) {
            frightenedTimer -= dt;
            if (frightenedTimer <= 0) {
                frightened = false;
                ghostsEatenCombo = 0;
            }
        }

        updateModeTimer(dt);

        for (let i = 0; i < ghosts.length; i++) {
            moveGhost(ghosts[i], i, dt);
        }

        checkCollisions();

        drawPacMan(time);
        drawGhosts(time);

    } else if (state === 'waiting') {
        drawPacMan(time);
        drawGhosts(time);

    } else if (state === 'dying') {
        stateTimer -= dt;
        const progress = 1 - (stateTimer / 1500);
        drawDyingAnimation(progress);

        if (stateTimer <= 0) {
            lives--;
            drawLives();
            if (lives <= 0) {
                state = 'gameover';
                document.getElementById('message').textContent = 'GAME OVER - Press any arrow key';
            } else {
                resetPac();
                resetGhosts();
                state = 'waiting';
                document.getElementById('message').textContent = 'Press any arrow key';
            }
        }

    } else if (state === 'levelcomplete') {
        drawPacMan(time);
        stateTimer -= dt;
        if (stateTimer <= 0) {
            level++;
            buildMap();
            resetPac();
            resetGhosts();
            modeTimer = 0;
            modeIndex = 0;
            state = 'waiting';
            document.getElementById('message').textContent = 'LEVEL ' + level + ' - Press any arrow key';
        }

    } else if (state === 'gameover') {
        drawGhosts(time);
    }

    requestAnimationFrame(update);
}

function startGame() {
    score = 0;
    lives = 3;
    level = 1;
    modeTimer = 0;
    modeIndex = 0;
    buildMap();
    resetPac();
    resetGhosts();
    updateScore();
    drawLives();
    state = 'waiting';
    document.getElementById('message').textContent = 'Press any arrow key to start';
}

document.getElementById('high-score').textContent = highScore;
startGame();
requestAnimationFrame(update);
