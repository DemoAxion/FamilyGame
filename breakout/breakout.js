const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const W = canvas.width;
const H = canvas.height;

// Ball image — place your image file as ball.png in this folder
const ballImg = new Image();
ballImg.src = 'ball.JPG';
let ballImgLoaded = false;
ballImg.onload = () => { ballImgLoaded = true; };

// Brick layout
const BRICK_ROWS = 6;
const BRICK_COLS = 10;
const BRICK_W = 56;
const BRICK_H = 20;
const BRICK_PAD = 4;
const BRICK_TOP = 50;
const BRICK_LEFT = (W - (BRICK_COLS * (BRICK_W + BRICK_PAD) - BRICK_PAD)) / 2;

const ROW_COLORS = ['#f44', '#f90', '#ff0', '#0c0', '#09f', '#a6f'];

// Paddle
const PADDLE_W = 100;
const PADDLE_H = 14;
const PADDLE_Y = H - 40;
const PADDLE_SPEED = 7;

// Ball
const BALL_RADIUS = 24;
const BALL_SPEED_INITIAL = 1.7;

// Game state
let score = 0;
let lives = 3;
let level = 1;
let state = 'idle'; // idle, playing, gameover
let bricks = [];
let totalBricks = 0;

let paddle = { x: W / 2 - PADDLE_W / 2, w: PADDLE_W };
let ball = { x: 0, y: 0, dx: 0, dy: 0, speed: BALL_SPEED_INITIAL, launched: false, angle: 0 };

// Input
let keys = {};
let mouseX = paddle.x + paddle.w / 2;

document.addEventListener('keydown', (e) => {
    keys[e.key] = true;
    if (e.key === ' ') {
        e.preventDefault();
        if (!ball.launched && state !== 'gameover') {
            launchBall();
        }
        if (state === 'gameover') {
            startGame();
        }
    }
});

document.addEventListener('keyup', (e) => {
    keys[e.key] = false;
});

canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    mouseX = e.clientX - rect.left;
});

canvas.addEventListener('click', () => {
    if (!ball.launched && state !== 'gameover') {
        launchBall();
    }
    if (state === 'gameover') {
        startGame();
    }
});

function buildBricks() {
    bricks = [];
    totalBricks = 0;
    for (let r = 0; r < BRICK_ROWS; r++) {
        bricks[r] = [];
        for (let c = 0; c < BRICK_COLS; c++) {
            bricks[r][c] = { alive: true };
            totalBricks++;
        }
    }
}

function resetBall() {
    ball.launched = false;
    ball.speed = BALL_SPEED_INITIAL + (level - 1) * 0.5;
    ball.dx = 0;
    ball.dy = 0;
}

function launchBall() {
    ball.launched = true;
    state = 'playing';
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * 0.8;
    ball.dx = Math.cos(angle) * ball.speed;
    ball.dy = Math.sin(angle) * ball.speed;
    document.getElementById('message').textContent = '';
}

function updatePaddle() {
    // Keyboard
    if (keys['ArrowLeft']) paddle.x -= PADDLE_SPEED;
    if (keys['ArrowRight']) paddle.x += PADDLE_SPEED;

    // Mouse — smooth follow
    const target = mouseX - paddle.w / 2;
    const diff = target - paddle.x;
    if (Math.abs(diff) > 2) {
        paddle.x += diff * 0.15;
    }

    // Clamp
    if (paddle.x < 0) paddle.x = 0;
    if (paddle.x + paddle.w > W) paddle.x = W - paddle.w;
}

function updateBall() {
    if (!ball.launched) {
        // Sit on paddle
        ball.x = paddle.x + paddle.w / 2;
        ball.y = PADDLE_Y - BALL_RADIUS;
        return;
    }

    ball.x += ball.dx;
    ball.y += ball.dy;
    ball.angle += 0.02;

    // Wall collisions
    if (ball.x - BALL_RADIUS < 0) {
        ball.x = BALL_RADIUS;
        ball.dx = Math.abs(ball.dx);
    }
    if (ball.x + BALL_RADIUS > W) {
        ball.x = W - BALL_RADIUS;
        ball.dx = -Math.abs(ball.dx);
    }
    if (ball.y - BALL_RADIUS < 0) {
        ball.y = BALL_RADIUS;
        ball.dy = Math.abs(ball.dy);
    }

    // Bottom — lose life
    if (ball.y + BALL_RADIUS > H) {
        lives--;
        updateUI();
        if (lives <= 0) {
            state = 'gameover';
            document.getElementById('message').textContent = 'GAME OVER — Click or Space to restart';
        } else {
            resetBall();
            document.getElementById('message').textContent = 'Click or Space to launch';
        }
        return;
    }

    // Paddle collision
    if (
        ball.dy > 0 &&
        ball.y + BALL_RADIUS >= PADDLE_Y &&
        ball.y + BALL_RADIUS <= PADDLE_Y + PADDLE_H &&
        ball.x >= paddle.x &&
        ball.x <= paddle.x + paddle.w
    ) {
        // Reflect with angle based on hit position
        const hit = (ball.x - paddle.x) / paddle.w; // 0 to 1
        const angle = -Math.PI / 2 + (hit - 0.5) * 1.2; // -120° to -60° range
        ball.dx = Math.cos(angle) * ball.speed;
        ball.dy = Math.sin(angle) * ball.speed;
        ball.y = PADDLE_Y - BALL_RADIUS;
    }

    // Brick collisions
    for (let r = 0; r < BRICK_ROWS; r++) {
        for (let c = 0; c < BRICK_COLS; c++) {
            const brick = bricks[r][c];
            if (!brick.alive) continue;

            const bx = BRICK_LEFT + c * (BRICK_W + BRICK_PAD);
            const by = BRICK_TOP + r * (BRICK_H + BRICK_PAD);

            if (
                ball.x + BALL_RADIUS > bx &&
                ball.x - BALL_RADIUS < bx + BRICK_W &&
                ball.y + BALL_RADIUS > by &&
                ball.y - BALL_RADIUS < by + BRICK_H
            ) {
                brick.alive = false;
                totalBricks--;
                score += (BRICK_ROWS - r) * 10;
                updateUI();

                // Determine bounce direction
                const overlapLeft = ball.x + BALL_RADIUS - bx;
                const overlapRight = bx + BRICK_W - (ball.x - BALL_RADIUS);
                const overlapTop = ball.y + BALL_RADIUS - by;
                const overlapBottom = by + BRICK_H - (ball.y - BALL_RADIUS);
                const minOverlap = Math.min(overlapLeft, overlapRight, overlapTop, overlapBottom);

                if (minOverlap === overlapTop || minOverlap === overlapBottom) {
                    ball.dy = -ball.dy;
                } else {
                    ball.dx = -ball.dx;
                }

                // Check level complete
                if (totalBricks <= 0) {
                    level++;
                    buildBricks();
                    resetBall();
                    document.getElementById('message').textContent = 'LEVEL ' + level + ' — Click or Space to launch';
                    updateUI();
                }

                return; // Only break one brick per frame
            }
        }
    }
}

function updateUI() {
    document.getElementById('score').textContent = score;
    document.getElementById('level').textContent = level;
    let str = '';
    for (let i = 0; i < lives; i++) str += '❤ ';
    document.getElementById('lives').textContent = str;
}

// Drawing
function drawPaddle() {
    // Main paddle body
    const gradient = ctx.createLinearGradient(paddle.x, PADDLE_Y, paddle.x, PADDLE_Y + PADDLE_H);
    gradient.addColorStop(0, '#8cf');
    gradient.addColorStop(1, '#369');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.roundRect(paddle.x, PADDLE_Y, paddle.w, PADDLE_H, 4);
    ctx.fill();

    // Highlight
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.fillRect(paddle.x + 4, PADDLE_Y + 2, paddle.w - 8, 3);
}

function drawBall() {
    if (ballImgLoaded) {
        ctx.save();
        ctx.translate(ball.x, ball.y);
        ctx.rotate(ball.angle);
        ctx.drawImage(
            ballImg,
            -BALL_RADIUS,
            -BALL_RADIUS,
            BALL_RADIUS * 2,
            BALL_RADIUS * 2
        );
        ctx.restore();
    } else {
        // Fallback circle if image not loaded
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, BALL_RADIUS, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.beginPath();
        ctx.arc(ball.x - 2, ball.y - 2, BALL_RADIUS * 0.4, 0, Math.PI * 2);
        ctx.fill();
    }
}

function drawBricks() {
    for (let r = 0; r < BRICK_ROWS; r++) {
        for (let c = 0; c < BRICK_COLS; c++) {
            if (!bricks[r][c].alive) continue;

            const bx = BRICK_LEFT + c * (BRICK_W + BRICK_PAD);
            const by = BRICK_TOP + r * (BRICK_H + BRICK_PAD);

            ctx.fillStyle = ROW_COLORS[r];
            ctx.beginPath();
            ctx.roundRect(bx, by, BRICK_W, BRICK_H, 3);
            ctx.fill();

            // Highlight
            ctx.fillStyle = 'rgba(255,255,255,0.25)';
            ctx.fillRect(bx + 2, by + 2, BRICK_W - 4, 4);

            // Shadow
            ctx.fillStyle = 'rgba(0,0,0,0.2)';
            ctx.fillRect(bx + 2, by + BRICK_H - 4, BRICK_W - 4, 3);
        }
    }
}

function draw() {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);

    drawBricks();
    drawPaddle();
    drawBall();

    if (state === 'gameover') {
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#f44';
        ctx.font = '40px Courier New';
        ctx.textAlign = 'center';
        ctx.fillText('GAME OVER', W / 2, H / 2 - 10);
        ctx.fillStyle = '#0ff';
        ctx.font = '20px Courier New';
        ctx.fillText('Score: ' + score, W / 2, H / 2 + 25);
    }
}

function gameLoop() {
    updatePaddle();
    if (state === 'playing') {
        updateBall();
    } else if (state === 'idle') {
        updateBall(); // keeps ball on paddle
    }
    draw();
    requestAnimationFrame(gameLoop);
}

function startGame() {
    score = 0;
    lives = 3;
    level = 1;
    state = 'idle';
    buildBricks();
    paddle.x = W / 2 - paddle.w / 2;
    resetBall();
    updateUI();
    document.getElementById('message').textContent = 'Click or Space to launch';
}

startGame();
requestAnimationFrame(gameLoop);