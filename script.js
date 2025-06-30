const board = document.getElementById('game-board');
const ctx = board.getContext('2d');
const currentScoreEl = document.getElementById('current-score');
const highScoreEl = document.getElementById('high-score');
const gameOverOverlay = document.getElementById('game-over-overlay');
const startMenuOverlay = document.getElementById('start-menu-overlay');
const restartButton = document.getElementById('restart-button');
const statusEffectEl = document.getElementById('status-effect');
const finalScoreEl = document.getElementById('final-score');
const pauseMenuOverlay = document.getElementById('pause-menu-overlay');
const resumeButton = document.getElementById('resume-button');
const pauseRestartButton = document.getElementById('pause-restart-button');
const quitButton = document.getElementById('quit-button');
const statFoodEatenEl = document.getElementById('stat-food-eaten');
const statLongestLengthEl = document.getElementById('stat-longest-length');
const statBoostsEl = document.getElementById('stat-boosts');
const difficultyButtons = document.querySelectorAll('.difficulty-btn');
const skinButtons = document.querySelectorAll('.skin-btn');

const GRID_SIZE = 20;
const BOARD_WIDTH = board.width;
const BOARD_HEIGHT = board.height;

const DIFFICULTIES = {
    easy: { initialSpeed: 150, speedIncreaseFactor: 0.97, scoreThreshold: 5 },
    medium: { initialSpeed: 120, speedIncreaseFactor: 0.95, scoreThreshold: 5 },
    hard: { initialSpeed: 90, speedIncreaseFactor: 0.93, scoreThreshold: 3 }
};
const OBSTACLE_COUNT = {
    easy: 3,
    medium: 5,
    hard: 7
};
const MOVING_OBSTACLE_COUNT = {
    easy: 0,
    medium: 2,
    hard: 4
};
const PORTAL_PAIR_COUNT = {
    easy: 0,
    medium: 1,
    hard: 1
};
const SNAKE_SKINS = {
    cyan: {
        head: '#22d3ee',
        bodyOpaque: '#67e8f9',
        bodyTransparent: 'rgba(103, 232, 249, 0.5)',
        eyes: '#111827'
    },
    crimson: {
        head: '#dc2626',
        bodyOpaque: '#f87171',
        bodyTransparent: 'rgba(248, 113, 113, 0.5)',
        eyes: '#111827'
    },
    gold: {
        head: '#f59e0b',
        bodyOpaque: '#fcd34d',
        bodyTransparent: 'rgba(252, 211, 77, 0.5)',
        eyes: '#111827'
    }
};
const MUSIC_THEMES = {
    classic: {
        drone: 55, // A1
        // A more melodic sequence in A minor
        melody: [220.00, 261.63, 293.66, 329.63, 293.66, 261.63, 220.00, null], // A3, C4, D4, E4, D4, C4, A3, rest
        noteDuration: 0.3,
        noteInterval: 400,
        oscillatorType: 'triangle'
    },
    forest: {
        drone: 48.99, // G1
        // A longer, more flowing melody in G major
        melody: [196.00, 246.94, 293.66, 392.00, 369.99, 293.66, 246.94, 196.00], // G3, B3, D4, G4, F#4, D4, B3, G3
        noteDuration: 0.4,
        noteInterval: 500,
        oscillatorType: 'sawtooth'
    },
    space: {
        drone: 41.20, // E1
        // A sparse, atmospheric melody with rests
        melody: [440.00, null, 523.25, null, 659.25, null, 587.33, null], // A4, C5, E5, D5 with rests
        noteDuration: 0.7,
        noteInterval: 800,
        oscillatorType: 'sine'
    }
};
const UNLOCK_THRESHOLDS = {
    crimson: 25,
    gold: 50,
};

let currentDifficulty;
let powerUpCycle = ['boost', 'ghost_mode', 'shrink', 'score_multiplier', 'poison']; // Define the cycle
let powerUpIndex = 0;

let snake = [{ x: 10, y: 10 }];
let food = {};
let obstacles = [];
let movingObstacles = [];
let portals = [];
let isGhostMode = false;
let ghostModeTimeoutId;
let teleportCooldown = 0;
let direction = 'right';
let dx = 1;
let dy = 0;
let score = 0;
let highScore = localStorage.getItem('snakeHighScore') || 0;
let isGameOver = false;
let gameLoopTimeout;
let baseSpeed = 120;
let isEating = false;
let foodEatenCount = 0;
let speedMultiplier = 1;
let boostTimeoutId;
let scoreMultiplier = 1;
let scoreMultiplierTimeoutId;

let gameStats;
let isPaused = false;
let unlockedSkins = [];
let selectedSkin = 'cyan';
let currentSkinColors;
let particles = [];
let audioCtx;
let musicNodes = {};
let melodyNoteIndex = 0;
let displayedScore = 0;
let scoreAnimationId;
let touchStartX = 0;
let touchStartY = 0;

function startGame(difficulty) {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    currentSkinColors = SNAKE_SKINS[selectedSkin];
    currentDifficulty = DIFFICULTIES[difficulty];
    startMenuOverlay.classList.add('hidden');
    initializeGame();
}

function initializeGame() {
    stopBackgroundMusic();
    snake = [{ x: 10, y: 10 }];
    isPaused = false;
    direction = 'right';
    dx = 1;
    dy = 0;
    score = 0;
    displayedScore = 0;
    isGameOver = false;
    baseSpeed = currentDifficulty.initialSpeed;
    isEating = false;
    foodEatenCount = 0;
    speedMultiplier = 1;
    clearTimeout(boostTimeoutId);
    scoreMultiplier = 1;
    clearTimeout(scoreMultiplierTimeoutId);
    particles = [];
    gameStats = {
        totalFoodEaten: 0,
        longestSnakeLength: 1,
        powerUpsCollected: {
            boost: 0,
            ghost_mode: 0,
            score_multiplier: 0,
            shrink: 0,
            growth_burst: 0,
        }
    };
    obstacles = [];
    generateObstacles();
    movingObstacles = [];
    generateMovingObstacles();
    isGhostMode = false;
    clearTimeout(ghostModeTimeoutId);
    portals = [];
    generatePortals();
    teleportCooldown = 0;
    powerUpIndex = 0; // Reset the cycle index
    currentScoreEl.parentElement.classList.remove('score-multiplier-active');
    pauseMenuOverlay.classList.add('hidden');
    board.classList.remove('speed-boost-active');
    statusEffectEl.textContent = 'NORMAL';
    statusEffectEl.parentElement.classList.remove('status-active');

    currentScoreEl.textContent = score;
    highScoreEl.textContent = highScore;
    gameOverOverlay.classList.add('hidden');

    // A small delay to allow the start menu to fade out
    setTimeout(() => {
        generateFood();
        main();
        startBackgroundMusic();
    }, 500);
}

function main() {
    if (isGameOver) {
        showGameOver();
        return;
    }

    gameLoopTimeout = setTimeout(() => {
        clearBoard();
        // Drawing and movement logic
        updateAndDrawParticles();
        drawObstacles();
        drawMovingObstacles();
        drawPortals();
        drawFood();
        moveMovingObstacles();
        moveSnake();
        drawSnake();
        main();
    }, baseSpeed * speedMultiplier); // Speed is affected by base speed and boost multiplier
}

function clearBoard() {
    ctx.fillStyle = '#0c0c0c';
    ctx.fillRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT);
}

function generateObstacles() {
    const obstacleCount = OBSTACLE_COUNT[Object.keys(DIFFICULTIES).find(key => DIFFICULTIES[key] === currentDifficulty)];
    const startArea = { x: 10, y: 10, radius: 4 }; // Safe zone around snake start

    for (let i = 0; i < obstacleCount; i++) {
        let obstacleX, obstacleY, isOnSnake, isOnObstacle, isTooCloseToStart;
        do {
            obstacleX = Math.floor(Math.random() * (BOARD_WIDTH / GRID_SIZE));
            obstacleY = Math.floor(Math.random() * (BOARD_HEIGHT / GRID_SIZE));

            isOnSnake = snake.some(segment => segment.x === obstacleX && segment.y === obstacleY);
            isOnObstacle = obstacles.some(o => o.x === obstacleX && o.y === obstacleY);
            isTooCloseToStart = Math.abs(obstacleX - startArea.x) < startArea.radius && Math.abs(obstacleY - startArea.y) < startArea.radius;

        } while (isOnSnake || isOnObstacle || isTooCloseToStart);

        obstacles.push({ x: obstacleX, y: obstacleY });
    }
}

function generateMovingObstacles() {
    const movingObstacleCount = MOVING_OBSTACLE_COUNT[Object.keys(DIFFICULTIES).find(key => DIFFICULTIES[key] === currentDifficulty)];
    const startArea = { x: 10, y: 10, radius: 5 }; // Larger safe zone

    for (let i = 0; i < movingObstacleCount; i++) {
        let obstacleX, obstacleY, isOnSnake, isOnObstacle, isOnMovingObstacle, isTooCloseToStart;
        do {
            obstacleX = Math.floor(Math.random() * (BOARD_WIDTH / GRID_SIZE));
            obstacleY = Math.floor(Math.random() * (BOARD_HEIGHT / GRID_SIZE));

            isOnSnake = snake.some(segment => segment.x === obstacleX && segment.y === obstacleY);
            isOnObstacle = obstacles.some(o => o.x === obstacleX && o.y === obstacleY);
            isOnMovingObstacle = movingObstacles.some(o => o.x === obstacleX && o.y === obstacleY);
            isTooCloseToStart = Math.abs(obstacleX - startArea.x) < startArea.radius && Math.abs(obstacleY - startArea.y) < startArea.radius;

        } while (isOnSnake || isOnObstacle || isOnMovingObstacle || isTooCloseToStart);

        // Randomly decide movement axis (horizontal or vertical)
        const movesHorizontally = Math.random() > 0.5;
        const dx = movesHorizontally ? (Math.random() > 0.5 ? 1 : -1) : 0;
        const dy = movesHorizontally ? 0 : (Math.random() > 0.5 ? 1 : -1);

        movingObstacles.push({ x: obstacleX, y: obstacleY, dx, dy });
    }
}

function generatePortals() {
    const portalPairCount = PORTAL_PAIR_COUNT[Object.keys(DIFFICULTIES).find(key => DIFFICULTIES[key] === currentDifficulty)];
    const safeMargin = 2; // Don't spawn portals right at the edge

    for (let i = 0; i < portalPairCount; i++) {
        let portalA = {};
        let portalB = {};
        let isInvalidPlacement;
        const allObstacles = [...obstacles, ...movingObstacles];

        do {
            isInvalidPlacement = false;
            // Generate portal A
            portalA.x = Math.floor(Math.random() * (BOARD_WIDTH / GRID_SIZE - safeMargin * 2)) + safeMargin;
            portalA.y = Math.floor(Math.random() * (BOARD_HEIGHT / GRID_SIZE - safeMargin * 2)) + safeMargin;

            // Generate portal B
            portalB.x = Math.floor(Math.random() * (BOARD_WIDTH / GRID_SIZE - safeMargin * 2)) + safeMargin;
            portalB.y = Math.floor(Math.random() * (BOARD_HEIGHT / GRID_SIZE - safeMargin * 2)) + safeMargin;

            // Check for collisions with obstacles
            if (allObstacles.some(o => (o.x === portalA.x && o.y === portalA.y) || (o.x === portalB.x && o.y === portalB.y))) {
                isInvalidPlacement = true;
                continue;
            }
            // Check if they are on top of each other or too close
            if (Math.abs(portalA.x - portalB.x) < 5 && Math.abs(portalA.y - portalB.y) < 5) {
                isInvalidPlacement = true;
            }
        } while (isInvalidPlacement);
        portals.push({ portalA, portalB });
    }
}

function drawObstacles() {
    ctx.fillStyle = '#374151'; // Cool Gray, like rocks
    ctx.strokeStyle = '#1f2937'; // Darker outline
    ctx.lineWidth = 2;

    obstacles.forEach(obstacle => {
        const x = obstacle.x * GRID_SIZE;
        const y = obstacle.y * GRID_SIZE;
        ctx.fillRect(x, y, GRID_SIZE, GRID_SIZE);
        ctx.strokeRect(x, y, GRID_SIZE, GRID_SIZE);
    });
}

function drawMovingObstacles() {
    ctx.fillStyle = '#ef4444'; // Red for danger
    ctx.strokeStyle = '#b91c1c'; // Darker red outline
    ctx.lineWidth = 2;

    movingObstacles.forEach(obstacle => {
        const x = obstacle.x * GRID_SIZE;
        const y = obstacle.y * GRID_SIZE;
        ctx.fillRect(x, y, GRID_SIZE, GRID_SIZE);
        ctx.strokeRect(x, y, GRID_SIZE, GRID_SIZE);
    });
}

function drawPortals() {
    const radius = GRID_SIZE / 2;
    const pulse = Math.abs(Math.sin(Date.now() / 300)); // Slower pulse
    const portalRadius = radius * (0.8 + pulse * 0.2);

    portals.forEach(pair => {
        // Portal A (e.g., blue)
        ctx.fillStyle = '#3b82f6';
        ctx.beginPath();
        ctx.arc(pair.portalA.x * GRID_SIZE + radius, pair.portalA.y * GRID_SIZE + radius, portalRadius, 0, 2 * Math.PI);
        ctx.fill();

        // Portal B (e.g., orange)
        ctx.fillStyle = '#f97316';
        ctx.beginPath();
        ctx.arc(pair.portalB.x * GRID_SIZE + radius, pair.portalB.y * GRID_SIZE + radius, portalRadius, 0, 2 * Math.PI);
        ctx.fill();
    });
}

function drawSnake() {
    const head = snake[0];
    const headRadius = GRID_SIZE / 2;

    // --- Draw Tapering Body ---
    // We draw from tail to head to ensure segments overlap correctly,
    // creating a smooth, continuous body.

    if (isGhostMode) {
        ctx.globalAlpha = 0.6;
    }

    for (let i = snake.length - 1; i > 0; i--) {
        const segment = snake[i];
        const nextSegment = snake[i - 1];

        const centerX = segment.x * GRID_SIZE + headRadius;
        const centerY = segment.y * GRID_SIZE + headRadius;
        const nextCenterX = nextSegment.x * GRID_SIZE + headRadius;
        const nextCenterY = nextSegment.y * GRID_SIZE + headRadius;

        // Calculate radius to make the snake taper towards the tail.
        // The tail (i = snake.length - 1) is smallest.
        const segmentRadius = (i / snake.length) * headRadius * 0.9 + headRadius * 0.1;

        // Check for a teleportation gap between this segment and the next.
        const isTeleportGap = Math.abs(segment.x - nextSegment.x) > 1 || Math.abs(segment.y - nextSegment.y) > 1;
        if (isTeleportGap) continue; // Don't draw the line that spans across the portal gap.

        // Draw a thick, rounded line to connect to the next segment
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(nextCenterX, nextCenterY);
        ctx.lineWidth = segmentRadius * 2; // Use diameter for thickness
        // Make the last segment translucent to indicate it's a "ghost" tail
        if (i === snake.length - 1 && snake.length > 3) {
            ctx.strokeStyle = currentSkinColors.bodyTransparent;
        } else {
            ctx.strokeStyle = currentSkinColors.bodyOpaque;
        }
        ctx.lineCap = 'round'; // Makes the joints smooth
        ctx.stroke();
    }

    // --- Draw Head ---
    const centerX = head.x * GRID_SIZE + headRadius;
    const centerY = head.y * GRID_SIZE + headRadius;

    // Draw the main head shape (circle or pac-man)
    ctx.fillStyle = currentSkinColors.head;
    if (isEating) {
        // Draw with open mouth (pac-man style)
        let startAngle = 0;
        let endAngle = 2 * Math.PI;
        const mouthAngle = 0.4 * Math.PI; // How wide the mouth is

        switch (direction) {
            case 'right': startAngle = mouthAngle / 2; endAngle = 2 * Math.PI - (mouthAngle / 2); break;
            case 'left': startAngle = Math.PI + mouthAngle / 2; endAngle = Math.PI - mouthAngle / 2; break;
            case 'up': startAngle = 1.5 * Math.PI + mouthAngle / 2; endAngle = 1.5 * Math.PI - mouthAngle / 2; break;
            case 'down': startAngle = 0.5 * Math.PI + mouthAngle / 2; endAngle = 0.5 * Math.PI - mouthAngle / 2; break;
        }
        ctx.beginPath();
        ctx.arc(centerX, centerY, headRadius, startAngle, endAngle);
        ctx.lineTo(centerX, centerY);
        ctx.closePath();
        ctx.fill();
    } else {
        // Draw a normal closed-mouth head
        ctx.beginPath();
        ctx.arc(centerX, centerY, headRadius, 0, 2 * Math.PI);
        ctx.fill();
    }

    // --- Draw Eyes ---
    const eyeRadius = 2.5;
    const eyeOffset = headRadius * 0.5;
    ctx.fillStyle = currentSkinColors.eyes;

    let eye1X, eye1Y, eye2X, eye2Y;

    switch (direction) {
        case 'right': eye1X = centerX + eyeOffset * 0.2; eye1Y = centerY - eyeOffset; eye2X = centerX + eyeOffset * 0.2; eye2Y = centerY + eyeOffset; break;
        case 'left': eye1X = centerX - eyeOffset * 0.2; eye1Y = centerY - eyeOffset; eye2X = centerX - eyeOffset * 0.2; eye2Y = centerY + eyeOffset; break;
        case 'up': eye1X = centerX - eyeOffset; eye1Y = centerY - eyeOffset * 0.2; eye2X = centerX + eyeOffset; eye2Y = centerY - eyeOffset * 0.2; break;
        case 'down': eye1X = centerX - eyeOffset; eye1Y = centerY + eyeOffset * 0.2; eye2X = centerX + eyeOffset; eye2Y = centerY + eyeOffset * 0.2; break;
    }

    [{ x: eye1X, y: eye1Y }, { x: eye2X, y: eye2Y }].forEach(eye => {
        ctx.beginPath();
        ctx.arc(eye.x, eye.y, eyeRadius, 0, 2 * Math.PI);
        ctx.fill();
    });

    if (isGhostMode) {
        ctx.globalAlpha = 1.0;
    }
}

function moveSnake() {
    if (teleportCooldown > 0) {
        teleportCooldown--;
    }

    const head = { x: snake[0].x + dx, y: snake[0].y + dy };

    // --- Portal Logic ---
    if (teleportCooldown === 0) {
        for (const pair of portals) {
            let didTeleport = false;
            let exitPortal;

            if (head.x === pair.portalA.x && head.y === pair.portalA.y) {
                exitPortal = pair.portalB;
                didTeleport = true;
            } else if (head.x === pair.portalB.x && head.y === pair.portalB.y) {
                exitPortal = pair.portalA;
                didTeleport = true;
            }

            if (didTeleport) {
                // Emerge from the exit portal, one step in the current direction
                head.x = exitPortal.x + dx;
                head.y = exitPortal.y + dy;
                teleportCooldown = 5; // 5 frames of immunity to prevent re-entry
                playPortalSound();
                break; // Exit loop once teleported
            }
        }
    }

    snake.unshift(head);

    checkCollisions();

    if (isGameOver) return;

    const hasEatenFood = snake[0].x === food.x && snake[0].y === food.y;
    if (hasEatenFood) {
        playEatSound(food.type);
        isEating = true;
        gameStats.totalFoodEaten++;
        // The snake grows by one, so its new length is snake.length + 1
        if (snake.length + 1 > gameStats.longestSnakeLength) {
            gameStats.longestSnakeLength = snake.length + 1;
        }

        const foodCenterX = food.x * GRID_SIZE + GRID_SIZE / 2;
        const foodCenterY = food.y * GRID_SIZE + GRID_SIZE / 2;
        let particleColor;

        // Handle scoring and effects based on food type
        switch (food.type) {
            case 'boost':
                gameStats.powerUpsCollected.boost++;
                activateSpeedBoost();
                score += scoreMultiplier;
                foodEatenCount = 0; // Reset count after any power-up
                break;
            case 'score_multiplier':
                particleColor = '#a78bfa';
                gameStats.powerUpsCollected.score_multiplier++;
                activateScoreMultiplier();
                score += scoreMultiplier;
                foodEatenCount = 0; // Reset count after any power-up
                break;
            case 'ghost_mode':
                particleColor = '#e0e0e0'; // a ghostly white
                gameStats.powerUpsCollected.ghost_mode++;
                activateGhostMode();
                foodEatenCount = 0; // Reset count after any power-up
                break;
            case 'shrink':
                particleColor = '#818cf8'; // Indigo
                gameStats.powerUpsCollected.shrink++;
                applyShrinkEffect();
                foodEatenCount = 0; // Reset count after any power-up
                // No score change for this power-up
                break;
            case 'growth_burst':
                particleColor = '#34d399'; // Emerald green
                gameStats.powerUpsCollected.growth_burst++;
                applyGrowthBurstEffect();
                score += 5; // Bonus points
                foodEatenCount = 0; // Reset count after any power-up
                break;
            case 'poison':
                particleColor = '#7cb342';
                applyPoisonEffect();
                foodEatenCount = 0; // Reset count after any power-up
                // No points for poison
                break;
            case 'golden_apple':
                particleColor = '#FFD700';
                score += 10; // High point value, ignores multiplier
                foodEatenCount++; // Acts like normal food for the cycle
                // Dynamic Speed Increase can also apply
                if (score > 0 && score % currentDifficulty.scoreThreshold === 0) {
                    const newSpeed = baseSpeed * currentDifficulty.speedIncreaseFactor;
                    baseSpeed = newSpeed > 40 ? newSpeed : 40;
                }
                break;
            default: // 'normal' food
                particleColor = '#f472b6';
                score += scoreMultiplier;
                foodEatenCount++;
                // Dynamic Speed Increase based on difficulty
                if (score > 0 && score % currentDifficulty.scoreThreshold === 0) {
                    const newSpeed = baseSpeed * currentDifficulty.speedIncreaseFactor;
                    baseSpeed = newSpeed > 40 ? newSpeed : 40; // Cap at a minimum speed
                }
                break;
        }
        createParticles(foodCenterX, foodCenterY, particleColor);
        cancelAnimationFrame(scoreAnimationId);
        updateScoreDisplay();
        generateFood();
    } else {
        isEating = false;
        snake.pop();
    }
}

function moveMovingObstacles() {
    movingObstacles.forEach(obstacle => {
        // Predict next position
        let nextX = obstacle.x + obstacle.dx;
        let nextY = obstacle.y + obstacle.dy;

        // Check for collisions that will require a direction change
        const willHitWall = nextX < 0 || nextX * GRID_SIZE >= BOARD_WIDTH || nextY < 0 || nextY * GRID_SIZE >= BOARD_HEIGHT;
        const willHitStaticObstacle = obstacles.some(staticObstacle => staticObstacle.x === nextX && staticObstacle.y === nextY);

        if (willHitWall || willHitStaticObstacle) {
            // Reverse direction
            obstacle.dx *= -1;
            obstacle.dy *= -1;
        }

        // Update position with the (potentially new) direction
        obstacle.x += obstacle.dx;
        obstacle.y += obstacle.dy;
    });
}

function generateFood() {
    let foodX, foodY;
    // Spawn a special food item every 5 normal foods eaten
    const spawnPowerUp = foodEatenCount > 0 && foodEatenCount % 5 === 0;

    do {
        foodX = Math.floor(Math.random() * (BOARD_WIDTH / GRID_SIZE));
        foodY = Math.floor(Math.random() * (BOARD_HEIGHT / GRID_SIZE));
    } while (snake.some(segment => segment.x === foodX && segment.y === foodY) || obstacles.some(o => o.x === foodX && o.y === foodY) || movingObstacles.some(o => o.x === foodX && o.y === foodY) || portals.some(p => (p.portalA.x === foodX && p.portalA.y === foodY) || (p.portalB.x === foodX && p.portalB.y === foodY)));

    let foodType = 'normal';
    if (spawnPowerUp) {
        foodType = powerUpCycle[powerUpIndex];
        powerUpIndex = (powerUpIndex + 1) % powerUpCycle.length;
    } else {
        // When not spawning a cycled power-up, there's a small chance for a rare item
        const GOLDEN_APPLE_CHANCE = 0.05; // 5% chance
        const GROWTH_BURST_CHANCE = 0.02; // 2% chance, making it rarer

        const rand = Math.random();
        if (rand < GROWTH_BURST_CHANCE) {
            foodType = 'growth_burst';
        } else if (rand < GROWTH_BURST_CHANCE + GOLDEN_APPLE_CHANCE) {
            // This ensures the chances don't overlap
            foodType = 'golden_apple';
        }
    }
    food = { x: foodX, y: foodY, type: foodType };
}

function drawFood() {
    const radius = GRID_SIZE / 2;
    const centerX = food.x * GRID_SIZE + radius;
    const centerY = food.y * GRID_SIZE + radius;
    let glowColor;

    // Determine glow color based on food type
    switch (food.type) {
        case 'boost':
        case 'golden_apple':
            glowColor = '#FFD700';
            break;
        case 'score_multiplier':
            glowColor = '#a78bfa';
            break;
        case 'poison':
            glowColor = '#7cb342';
            break;
        case 'ghost_mode':
            glowColor = '#e0e0e0';
            break;
        case 'shrink':
            glowColor = '#818cf8'; // Indigo
            break;
        case 'growth_burst':
            glowColor = '#34d399'; // Emerald green
            break;
        default: // 'normal'
            glowColor = '#f472b6';
            break;
    }

    // Apply glow effect
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = 15;

    // Draw the food item
    if (food.type === 'boost') {
        const pulse = Math.abs(Math.sin(Date.now() / 200));
        const boostRadius = radius * (0.7 + pulse * 0.2);
        ctx.fillStyle = '#FFD700';
        ctx.beginPath();
        ctx.arc(centerX, centerY, boostRadius, 0, 2 * Math.PI);
        ctx.fill();
    } else if (food.type === 'score_multiplier') {
        const pulse = Math.abs(Math.sin(Date.now() / 200));
        const multiplierRadius = radius * (0.7 + pulse * 0.2);
        ctx.fillStyle = '#a78bfa';
        ctx.beginPath();
        ctx.arc(centerX, centerY, multiplierRadius, 0, 2 * Math.PI);
        ctx.fill();
    } else if (food.type === 'poison') {
        const pulse = Math.abs(Math.sin(Date.now() / 200));
        const poisonRadius = radius * (0.7 + pulse * 0.2);
        ctx.fillStyle = '#7cb342';
        ctx.beginPath();
        ctx.arc(centerX, centerY, poisonRadius, 0, 2 * Math.PI);
        ctx.fill();
    } else if (food.type === 'shrink') {
        const pulse = Math.abs(Math.sin(Date.now() / 200));
        const shrinkRadius = radius * (0.7 + pulse * 0.2);
        ctx.fillStyle = '#818cf8'; // Indigo
        ctx.beginPath();
        ctx.arc(centerX, centerY, shrinkRadius, 0, 2 * Math.PI);
        ctx.fill();
    } else if (food.type === 'growth_burst') {
        const pulse = Math.abs(Math.sin(Date.now() / 150)); // Faster pulse
        const growthRadius = radius * (0.8 + pulse * 0.2);
        ctx.fillStyle = '#34d399'; // Emerald green
        ctx.beginPath();
        ctx.arc(centerX, centerY, growthRadius, 0, 2 * Math.PI);
        ctx.fill();
    } else if (food.type === 'ghost_mode') {
        const pulse = Math.abs(Math.sin(Date.now() / 200));
        const ghostRadius = radius * (0.7 + pulse * 0.2);
        ctx.fillStyle = '#e0e0e0'; // Ghostly white
        ctx.beginPath();
        ctx.arc(centerX, centerY, ghostRadius, 0, 2 * Math.PI);
        ctx.fill();
    } else if (food.type === 'golden_apple') {
        const goldenRadius = radius * 0.9;
        ctx.fillStyle = '#FFD700';
        ctx.beginPath();
        ctx.arc(centerX, centerY, goldenRadius, 0, 2 * Math.PI);
        ctx.fill();
        ctx.shadowBlur = 0; // No glow for the small glint
        ctx.fillStyle = 'white';
        ctx.beginPath();
        ctx.arc(centerX - goldenRadius * 0.4, centerY - goldenRadius * 0.4, goldenRadius * 0.2, 0, 2 * Math.PI);
        ctx.fill();
    } else {
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius * 0.8, 0, 2 * Math.PI);
        ctx.fillStyle = '#f472b6';
        ctx.fill();
    }

    // Reset glow effect so it doesn't affect other drawings
    ctx.shadowBlur = 0;
    ctx.shadowColor = 'transparent';
}

function activateSpeedBoost() {
    clearTimeout(boostTimeoutId); // Clear any existing boost
    board.classList.add('speed-boost-active');
    speedMultiplier = 0.4; // 40% of normal speed (faster)
    boostTimeoutId = setTimeout(() => {
        speedMultiplier = 1; // Reset to normal speed
        board.classList.remove('speed-boost-active');
    }, 5000); // 5 seconds
}

function activateScoreMultiplier() {
    clearTimeout(scoreMultiplierTimeoutId); // Clear any existing multiplier
    currentScoreEl.parentElement.classList.add('score-multiplier-active');
    scoreMultiplier = 2; // Double score

    scoreMultiplierTimeoutId = setTimeout(() => {
        scoreMultiplier = 1; // Reset to normal
        currentScoreEl.parentElement.classList.remove('score-multiplier-active');
    }, 10000); // 10 seconds
}

function applyPoisonEffect() {
    board.classList.add('poisoned-active');
    setTimeout(() => board.classList.remove('poisoned-active'), 500); // Visual effect for 0.5s

    // Shorten snake by 2 segments (pop 3 times to counteract the growth from eating)
    const segmentsToShrink = 3;
    const minLength = 3;

    for (let i = 0; i < segmentsToShrink && snake.length > minLength; i++) {
        snake.pop();
    }
}

function applyShrinkEffect() {
    playShrinkSound();
    // The snake just grew by one segment from eating the power-up.
    // To shed 3 segments, we need to pop 4 times.
    const segmentsToShrink = 4;
    const minLength = 3;

    for (let i = 0; i < segmentsToShrink && snake.length > minLength; i++) {
        snake.pop();
    }
}

function applyGrowthBurstEffect() {
    playGrowthBurstSound();
    const segmentsToAdd = 5;
    const tail = snake[snake.length - 1];
    for (let i = 0; i < segmentsToAdd; i++) {
        // Add new segments at the same position as the current tail.
        // They will follow the snake's path on the next frames.
        snake.push({ ...tail });
    }
}

function activateGhostMode() {
    clearTimeout(ghostModeTimeoutId);
    isGhostMode = true;
    statusEffectEl.textContent = 'GHOST MODE';
    statusEffectEl.parentElement.classList.add('status-active');

    ghostModeTimeoutId = setTimeout(() => {
        isGhostMode = false;
        statusEffectEl.textContent = 'NORMAL';
        statusEffectEl.parentElement.classList.remove('status-active');
    }, 7000); // 7 seconds
}

function playPortalSound() {
    if (!audioCtx) return;
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    oscillator.type = 'sawtooth';
    gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
    oscillator.frequency.setValueAtTime(100, audioCtx.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(1000, audioCtx.currentTime + 0.3);
    gainNode.gain.exponentialRampToValueAtTime(0.00001, audioCtx.currentTime + 0.3);
    oscillator.start();
    oscillator.stop(audioCtx.currentTime + 0.3);
}

function playGrowthBurstSound() {
    if (!audioCtx) return;
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    oscillator.type = 'sine';
    gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
    // Ascending sound effect
    oscillator.frequency.setValueAtTime(220, audioCtx.currentTime); // A3
    oscillator.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.3); // Ascends to A5
    gainNode.gain.exponentialRampToValueAtTime(0.00001, audioCtx.currentTime + 0.3);
    oscillator.start();
    oscillator.stop(audioCtx.currentTime + 0.3);
}

function playShrinkSound() {
    if (!audioCtx) return;
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    oscillator.type = 'sawtooth';
    gainNode.gain.setValueAtTime(0.08, audioCtx.currentTime);
    // Descending sound effect
    oscillator.frequency.setValueAtTime(440, audioCtx.currentTime); // A4
    oscillator.frequency.exponentialRampToValueAtTime(220, audioCtx.currentTime + 0.2); // Descends to A3
    gainNode.gain.exponentialRampToValueAtTime(0.00001, audioCtx.currentTime + 0.2);
    oscillator.start();
    oscillator.stop(audioCtx.currentTime + 0.2);
}

function playEatSound(foodType) {
    if (!audioCtx) return;

    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);

    let freq = 440;
    let type = 'triangle';
    let duration = 0.2;

    switch (foodType) {
        case 'poison':
            freq = 164.81; // E3
            type = 'square';
            duration = 0.3;
            break;
        case 'boost':
        case 'golden_apple':
            freq = 1318.51; // E6 (high and rewarding)
            type = 'sine';
            duration = 0.15;
            break;
        case 'score_multiplier':
            freq = 659.25; // E5
            type = 'sine';
            duration = 0.25;
            break;
        case 'ghost_mode':
            freq = 987.77; // B5
            type = 'sine';
            duration = 0.4;
            break;
        case 'shrink':
            // This sound is handled by its own function, so we do nothing here.
            // This case prevents the default sound from playing.
            return;
        case 'growth_burst':
            // This sound is handled by its own function
            return;
        default: // 'normal' food
            freq = 880; // A5
            break;
    }

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(freq, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.00001, audioCtx.currentTime + duration);
    oscillator.start(audioCtx.currentTime);
    oscillator.stop(audioCtx.currentTime + duration);
}

function playGameOverSound() {
    if (!audioCtx) return;
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    oscillator.type = 'sawtooth';
    oscillator.frequency.setValueAtTime(220, audioCtx.currentTime); // A3
    oscillator.frequency.exponentialRampToValueAtTime(55, audioCtx.currentTime + 0.5); // Descends to A2
    gainNode.gain.setValueAtTime(0.15, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.00001, audioCtx.currentTime + 0.5);
    oscillator.start(audioCtx.currentTime);
    oscillator.stop(audioCtx.currentTime + 0.5);
}

function startBackgroundMusic() {
    if (!audioCtx || musicNodes.drone) return; // Music is already playing

    // Since theme selection was removed, default to 'classic' music to prevent errors.
    const themeMusic = MUSIC_THEMES['classic'];

    // --- Drone ---
    const drone = audioCtx.createOscillator();
    drone.type = 'sine';
    drone.frequency.setValueAtTime(themeMusic.drone, audioCtx.currentTime);
    const droneGain = audioCtx.createGain();
    droneGain.gain.setValueAtTime(0.03, audioCtx.currentTime); // Quieter drone
    drone.connect(droneGain);
    droneGain.connect(audioCtx.destination);
    drone.start();
    musicNodes.drone = drone;

    // --- Melody ---
    melodyNoteIndex = 0;
    musicNodes.sequencerId = setInterval(playMelodyNote, themeMusic.noteInterval);
}

function playMelodyNote() {
    if (!audioCtx) return;
    // Since theme selection was removed, default to 'classic' music to prevent errors.
    const themeMusic = MUSIC_THEMES['classic'];
    const freq = themeMusic.melody[melodyNoteIndex];

    // Handle rests (null values) in the melody
    if (freq) {
        const noteOsc = audioCtx.createOscillator();
        noteOsc.type = themeMusic.oscillatorType;
        noteOsc.frequency.setValueAtTime(freq, audioCtx.currentTime);

        const noteGain = audioCtx.createGain();
        noteGain.gain.setValueAtTime(0.06, audioCtx.currentTime); // Quieter melody
        noteGain.gain.exponentialRampToValueAtTime(0.00001, audioCtx.currentTime + themeMusic.noteDuration);

        noteOsc.connect(noteGain);
        noteGain.connect(audioCtx.destination);
        noteOsc.start();
        noteOsc.stop(audioCtx.currentTime + themeMusic.noteDuration + 0.1);
    }

    melodyNoteIndex = (melodyNoteIndex + 1) % themeMusic.melody.length;
}

function stopBackgroundMusic() {
    if (musicNodes.drone) musicNodes.drone.stop();
    clearInterval(musicNodes.sequencerId);
    musicNodes = {};
}

function createParticles(x, y, color) {
    const particleCount = 12; // How many particles to create
    for (let i = 0; i < particleCount; i++) {
        particles.push({
            x: x,
            y: y,
            dx: (Math.random() - 0.5) * 2.5, // Random direction and speed
            dy: (Math.random() - 0.5) * 2.5,
            size: Math.random() * 3 + 2, // Random size
            lifespan: 40, // How many frames it lives
            color: color
        });
    }
}

function updateAndDrawParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.dx;
        p.y += p.dy;
        p.lifespan--;

        if (p.lifespan <= 0) {
            particles.splice(i, 1); // Remove dead particle
        } else {
            ctx.globalAlpha = p.lifespan / 40; // Fade out over time
            ctx.fillStyle = p.color;
            ctx.fillRect(p.x, p.y, p.size, p.size); // Draw as small squares
            ctx.globalAlpha = 1.0; // Reset global alpha
        }
    }
}

function changeDirection(event) {
    const keyPressed = event.key;
    switch (keyPressed) {
        case 'ArrowLeft':
            setDirection('left');
            break;
        case 'ArrowRight':
            setDirection('right');
            break;
        case 'ArrowUp':
            setDirection('up');
            break;
        case 'ArrowDown':
            setDirection('down');
            break;
    }
}

function setDirection(newDirection) {
    if (isPaused || isGameOver) return;
    const goingUp = direction === 'up';
    const goingDown = direction === 'down';
    const goingRight = direction === 'right';
    const goingLeft = direction === 'left';

    if (newDirection === 'left' && !goingRight) { direction = 'left'; dx = -1; dy = 0; }
    if (newDirection === 'right' && !goingLeft) { direction = 'right'; dx = 1; dy = 0; }
    if (newDirection === 'up' && !goingDown) { direction = 'up'; dx = 0; dy = -1; }
    if (newDirection === 'down' && !goingUp) { direction = 'down'; dx = 0; dy = 1; }
}

function checkCollisions() {
    const head = snake[0];
    const oldHead = snake.length > 1 ? snake[1] : null;

    // Wall collision
    if (
        head.x < 0 ||
        head.x * GRID_SIZE >= BOARD_WIDTH ||
        head.y < 0 ||
        head.y * GRID_SIZE >= BOARD_HEIGHT
    ) {
        isGameOver = true;
        return;
    }

    // Self collision
    // If snake is long enough, ignore the very last tail segment for collision.
    const end = snake.length > 3 ? snake.length - 1 : snake.length;
    for (let i = 1; i < end; i++) {
        if (head.x === snake[i].x && head.y === snake[i].y) {
            isGameOver = true;
            return;
        }
    }

    // Obstacle collisions are ignored during ghost mode
    if (!isGhostMode) {
        // Static Obstacle collision
        if (obstacles.some(obstacle => head.x === obstacle.x && head.y === obstacle.y)) {
            isGameOver = true;
            return;
        }

        // Moving obstacle collision (handles direct hits and pass-throughs)
        for (const obstacle of movingObstacles) {
            if (head.x === obstacle.x && head.y === obstacle.y) {
                isGameOver = true;
                return;
            }
            if (oldHead && head.x === (obstacle.x - obstacle.dx) && head.y === (obstacle.y - obstacle.dy) && obstacle.x === oldHead.x && obstacle.y === oldHead.y) {
                isGameOver = true;
                return;
            }
        }
    }
}

function showGameOver() {
    stopBackgroundMusic();
    playGameOverSound();
    clearTimeout(gameLoopTimeout);
    updateHighScore();
    finalScoreEl.textContent = score;
    gameOverOverlay.classList.remove('hidden');

    // Display final stats
    statFoodEatenEl.textContent = gameStats.totalFoodEaten;
    statLongestLengthEl.textContent = gameStats.longestSnakeLength;
    statBoostsEl.textContent = gameStats.powerUpsCollected.boost;

    // Add screen shake effect
    const gameContainer = document.querySelector('.game-container');
    gameContainer.classList.add('shake');
    // Remove the class after the animation completes
    setTimeout(() => {
        gameContainer.classList.remove('shake');
    }, 500); // Duration should match the CSS animation
}

function updateHighScore() {
    if (score > highScore) {
        highScore = score;
        localStorage.setItem('snakeHighScore', highScore);
        highScoreEl.textContent = highScore;
        checkSkinUnlocks(highScore);
    }
}

function updateScoreDisplay() {
    if (displayedScore < score) {
        // The increment determines how fast the score "rolls up".
        // A larger divisor means a slower, smoother animation.
        const increment = Math.max(1, (score - displayedScore) / 15);
        displayedScore += increment;

        // Ensure we don't overshoot the target score
        if (displayedScore > score) {
            displayedScore = score;
        }
    }

    currentScoreEl.textContent = Math.floor(displayedScore);

    // If the displayed score is still not caught up, continue the animation.
    if (displayedScore < score) {
        scoreAnimationId = requestAnimationFrame(updateScoreDisplay);
    }
}

function restartGame() {
    gameOverOverlay.classList.add('hidden');
    // Add a delay to allow the fade-out animation to complete
    setTimeout(() => {
        initializeGame();
    }, 500); // Match the CSS transition duration
}

function togglePause() {
    // Can only pause if the game is actually running
    const gameIsActive = !isGameOver && startMenuOverlay.classList.contains('hidden');
    if (!gameIsActive && !isPaused) {
        return;
    }

    isPaused = !isPaused;

    if (isPaused) {
        clearTimeout(gameLoopTimeout);
        stopBackgroundMusic();
        pauseMenuOverlay.classList.remove('hidden');
    } else {
        pauseMenuOverlay.classList.add('hidden');
        startBackgroundMusic();
        main(); // Resume game loop
    }
}

function quitGame() {
    isPaused = false;
    isGameOver = true; // Effectively stops any game logic
    clearTimeout(gameLoopTimeout);
    stopBackgroundMusic();
    pauseMenuOverlay.classList.add('hidden');
    startMenuOverlay.classList.remove('hidden');
    // Optional: clear the board visually
    clearBoard();
}

function checkSkinUnlocks(newHighScore) {
    for (const skin in UNLOCK_THRESHOLDS) {
        if (newHighScore >= UNLOCK_THRESHOLDS[skin] && !unlockedSkins.includes(skin)) {
            unlockSkin(skin);
        }
    }
}

function unlockSkin(skinName) {
    unlockedSkins.push(skinName);
    localStorage.setItem('snakeUnlockedSkins', JSON.stringify(unlockedSkins));
    alert(`New High Score! You've unlocked the ${skinName.charAt(0).toUpperCase() + skinName.slice(1)} skin!`);
    updateSkinButtonsUI();
}

function loadUnlockedSkins() {
    const savedSkins = localStorage.getItem('snakeUnlockedSkins');
    if (savedSkins) {
        unlockedSkins = JSON.parse(savedSkins);
    } else {
        unlockedSkins = ['cyan']; // Default skin
    }
}

function updateSkinButtonsUI() {
    skinButtons.forEach(button => {
        const skin = button.dataset.skin;
        if (unlockedSkins.includes(skin)) {
            button.disabled = false;
            button.classList.remove('locked');
        } else {
            button.disabled = true;
            button.classList.add('locked');
        }
    });
}

// Event Listeners
document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
        togglePause();
    } else {
        // Pass other keys to the direction handler
        changeDirection(event);
    }
});
restartButton.addEventListener('click', restartGame);

difficultyButtons.forEach(button => {
    button.addEventListener('click', () => {
        const difficulty = button.dataset.difficulty;
        if (difficulty) {
            startGame(difficulty);
        }
    });
});

skinButtons.forEach(button => {
    button.addEventListener('click', () => {
        // Remove active class from all skin buttons
        skinButtons.forEach(btn => btn.classList.remove('active'));
        // Add active class to the clicked button
        button.classList.add('active');
        // Update the selected skin
        selectedSkin = button.dataset.skin;
    });
});

resumeButton.addEventListener('click', togglePause);

pauseRestartButton.addEventListener('click', () => {
    isPaused = false;
    pauseMenuOverlay.classList.add('hidden');
    setTimeout(() => {
        initializeGame(); // This will handle stopping music and resetting state
    }, 300); // Match pause menu transition
});

quitButton.addEventListener('click', quitGame);

// --- Touch Controls ---
board.addEventListener('touchstart', (e) => {
    e.preventDefault(); // prevent screen from moving or zooming
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
}, { passive: false });

board.addEventListener('touchend', (e) => {
    if (!touchStartX || !touchStartY) {
        return;
    }
    e.preventDefault();

    // Use changedTouches because e.touches is empty on touchend
    let touchEndX = e.changedTouches[0].clientX;
    let touchEndY = e.changedTouches[0].clientY;

    let diffX = touchEndX - touchStartX;
    let diffY = touchEndY - touchStartY;

    const swipeThreshold = 30; // Min distance for a swipe to be registered

    // Determine if it was a horizontal or vertical swipe
    if (Math.abs(diffX) > Math.abs(diffY)) { // Horizontal swipe
        if (Math.abs(diffX) > swipeThreshold) setDirection(diffX > 0 ? 'right' : 'left');
    } else { // Vertical swipe
        if (Math.abs(diffY) > swipeThreshold) setDirection(diffY > 0 ? 'down' : 'up');
    }

    // Reset the start coordinates for the next swipe
    touchStartX = 0;
    touchStartY = 0;
}, { passive: false });

// --- App Initialization ---
loadUnlockedSkins();
updateSkinButtonsUI();