/**
 * Merge6x6 Game Logic - Production Quality
 * Inspired by number-merging block puzzle games.
 */

// --- Global Constants & Config ---
const BOARD_SIZE = 6;
const NUMBERS_SEQUENCE = [2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048, 4096, 8192];

// Sound Configuration (Synthesized programmatically using Web Audio API)
let audioCtx = null;

// --- Game State Variables ---
let board = Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(0));
let queue = []; // Queue of active & next blocks (always 4 elements: 0 is current, 1-3 is next)
let score = 0;
let bestScore = 0;
let level = 1;
let xp = 0;
let xpNeeded = 500;
let combo = 1;
let isPaused = false;
let isGameOver = false;
let gameMode = 'endless'; // 'endless' or 'daily'
let undoHistory = []; // Stores state snapshots for Undo
const MAX_UNDO_STATES = 10;

// Settings
let currentTheme = 'classic';
let particlesEnabled = 'high';
let soundEnabled = true;

// Drag & Drop tracking
let isDragging = false;
let dragStartX = 0;
let dragStartY = 0;
let currentDragOverCell = null;

// Canvas Particles & Confetti
const canvas = document.getElementById('effects-canvas');
const ctx = canvas.getContext('2d');
let particles = [];
let confetti = [];

// Seeded RNG for Daily Challenge
let dailySeed = 1;

// List of all possible Achievements
const ACHIEVEMENT_DEFS = [
    { id: 'first_merge', name: 'First Fusion', desc: 'Merge two identical blocks for the first time.', icon: '⚡' },
    { id: 'combo_3', name: 'Combo Master', desc: 'Reach a 3x merge combo chain.', icon: '🔥' },
    { id: 'block_128', name: 'Centurion', desc: 'Create a 128 block.', icon: '🎯' },
    { id: 'block_1024', name: 'Titan', desc: 'Create a 1024 block.', icon: '🌌' },
    { id: 'block_2048', name: '2048 Champion', desc: 'Reach the legendary 2048 block!', icon: '🏆' },
    { id: 'block_8192', name: 'Ascension', desc: 'Reach the ultimate 8192 block!', icon: '👑' },
    { id: 'daily_play', name: 'Daily Adventurer', desc: 'Play the Daily Challenge mode.', icon: '📅' },
    { id: 'level_5', name: 'Expert Merger', desc: 'Reach Level 5.', icon: '🌟' },
    { id: 'undo_move', name: 'Time Traveler', desc: 'Use the Undo button to reverse fate.', icon: '⏳' },
    { id: 'board_full_save', name: 'Close Call', desc: 'Merge blocks when board is 90% full.', icon: '🚨' }
];

// Statistics tracking
let stats = {
    gamesPlayed: 0,
    totalMerges: 0,
    highestBlock: 2,
    maxCombo: 1,
    dailyBest: 0
};

// Achievements unlocked state
let unlockedAchievements = [];

// --- Seeded Random Engine (LCG) ---
function seedRandom(seed) {
    dailySeed = seed;
}

function nextRandom() {
    // Linear Congruential Generator
    dailySeed = (dailySeed * 9301 + 49297) % 233280;
    return dailySeed / 233280;
}

// Get seed based on current date (YYYYMMDD)
function getDailySeed() {
    const d = new Date();
    return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}

// --- Audio Synthesizer (Web Audio API) ---
function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
}

function playSynthesizedSound(type, pitchModifier = 1) {
    if (!soundEnabled) return;
    initAudio();
    
    try {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        
        const now = audioCtx.currentTime;
        
        if (type === 'place') {
            // Pleasant short pop
            osc.type = 'sine';
            osc.frequency.setValueAtTime(440 * pitchModifier, now);
            osc.frequency.exponentialRampToValueAtTime(880 * pitchModifier, now + 0.1);
            gain.gain.setValueAtTime(0.15, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
            osc.start(now);
            osc.stop(now + 0.1);
        } else if (type === 'merge') {
            // Rising warm synth note
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(261.63 * pitchModifier, now);
            osc.frequency.exponentialRampToValueAtTime(523.25 * pitchModifier, now + 0.2);
            gain.gain.setValueAtTime(0.2, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
            osc.start(now);
            osc.stop(now + 0.25);
        } else if (type === 'combo') {
            // Arpeggio / chime sequence
            osc.type = 'sine';
            osc.frequency.setValueAtTime(587.33 * pitchModifier, now); // D5
            osc.frequency.setValueAtTime(659.25 * pitchModifier, now + 0.08); // E5
            osc.frequency.setValueAtTime(880 * pitchModifier, now + 0.16); // A5
            gain.gain.setValueAtTime(0.15, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
            osc.start(now);
            osc.stop(now + 0.3);
        } else if (type === 'levelup') {
            // Joyful chord
            osc.type = 'sine';
            osc.frequency.setValueAtTime(523.25, now); // C5
            osc.frequency.exponentialRampToValueAtTime(1046.50, now + 0.4); // C6
            gain.gain.setValueAtTime(0.2, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
            
            // Sub-harmony oscillator
            const osc2 = audioCtx.createOscillator();
            const gain2 = audioCtx.createGain();
            osc2.connect(gain2);
            gain2.connect(audioCtx.destination);
            osc2.type = 'sine';
            osc2.frequency.setValueAtTime(659.25, now); // E5
            osc2.frequency.exponentialRampToValueAtTime(1318.51, now + 0.4); // E6
            gain2.gain.setValueAtTime(0.1, now);
            gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
            
            osc.start(now);
            osc.stop(now + 0.5);
            osc2.start(now);
            osc2.stop(now + 0.5);
        } else if (type === 'gameover') {
            // Sad descending notes
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(293.66, now); // D4
            osc.frequency.linearRampToValueAtTime(146.83, now + 0.6); // D3
            gain.gain.setValueAtTime(0.15, now);
            gain.gain.linearRampToValueAtTime(0.01, now + 0.6);
            osc.start(now);
            osc.stop(now + 0.6);
        } else if (type === 'click') {
            // Tiny ticking sounds
            osc.type = 'sine';
            osc.frequency.setValueAtTime(1000, now);
            gain.gain.setValueAtTime(0.05, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
            osc.start(now);
            osc.stop(now + 0.05);
        }
    } catch (e) {
        console.error("Audio error", e);
    }
}

// --- Local Storage & Persistent State Helpers ---
function loadGameData() {
    bestScore = parseInt(localStorage.getItem('m6x6_bestScore')) || 0;
    
    const savedTheme = localStorage.getItem('m6x6_theme');
    if (savedTheme) {
        currentTheme = savedTheme;
        document.body.setAttribute('data-active-theme', currentTheme);
    }
    
    const savedParticles = localStorage.getItem('m6x6_particles');
    if (savedParticles) particlesEnabled = savedParticles;
    
    const savedSound = localStorage.getItem('m6x6_sound');
    if (savedSound !== null) soundEnabled = savedSound === 'true';
    
    const savedStats = localStorage.getItem('m6x6_stats');
    if (savedStats) stats = JSON.parse(savedStats);
    
    const savedAchievements = localStorage.getItem('m6x6_achievements');
    if (savedAchievements) unlockedAchievements = JSON.parse(savedAchievements);

    // Auto-load mid-game state if it exists
    const autoSaveState = localStorage.getItem('m6x6_autosave');
    if (autoSaveState && gameMode === 'endless') {
        try {
            const data = JSON.parse(autoSaveState);
            board = data.board;
            queue = data.queue;
            score = data.score;
            level = data.level;
            xp = data.xp;
            xpNeeded = data.xpNeeded;
            combo = data.combo;
            isGameOver = data.isGameOver;
            undoHistory = data.undoHistory || [];
            updateUI();
            renderBoard();
        } catch (e) {
            console.error("Error restoring autosave", e);
            startNewGame();
        }
    } else {
        startNewGame();
    }
}

function saveGameData() {
    localStorage.setItem('m6x6_bestScore', bestScore);
    localStorage.setItem('m6x6_theme', currentTheme);
    localStorage.setItem('m6x6_particles', particlesEnabled);
    localStorage.setItem('m6x6_sound', soundEnabled);
    localStorage.setItem('m6x6_stats', JSON.stringify(stats));
    localStorage.setItem('m6x6_achievements', JSON.stringify(unlockedAchievements));
    
    if (gameMode === 'endless' && !isGameOver) {
        const state = { board, queue, score, level, xp, xpNeeded, combo, isGameOver, undoHistory };
        localStorage.setItem('m6x6_autosave', JSON.stringify(state));
    } else {
        localStorage.removeItem('m6x6_autosave');
    }
}

function resetAllData() {
    localStorage.clear();
    bestScore = 0;
    currentTheme = 'classic';
    particlesEnabled = 'high';
    soundEnabled = true;
    stats = { gamesPlayed: 0, totalMerges: 0, highestBlock: 2, maxCombo: 1, dailyBest: 0 };
    unlockedAchievements = [];
    document.body.removeAttribute('data-active-theme');
    showToast('⚙️ System', 'All game records & achievements have been reset!');
    saveGameData();
    startNewGame();
}

// --- Canvas Animation Effects Loop ---
function setupCanvas() {
    const resize = () => {
        const rect = gameWrapper.getBoundingClientRect();
        canvas.width = rect.width;
        canvas.height = rect.height;
    };
    const gameWrapper = document.getElementById('game-wrapper');
    resize();
    window.addEventListener('resize', resize);
    
    // Animation loop
    function loop() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Update & Draw Particles
        if (particlesEnabled !== 'off') {
            for (let i = particles.length - 1; i >= 0; i--) {
                const p = particles[i];
                p.x += p.vx;
                p.y += p.vy;
                p.vy += 0.2; // Gravity
                p.alpha -= 0.02;
                p.size *= 0.96;
                
                if (p.alpha <= 0 || p.size <= 0.5) {
                    particles.splice(i, 1);
                    continue;
                }
                
                ctx.save();
                ctx.globalAlpha = p.alpha;
                ctx.fillStyle = p.color;
                ctx.shadowBlur = 10;
                ctx.shadowColor = p.color;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            }
        }
        
        // Update & Draw Confetti
        for (let i = confetti.length - 1; i >= 0; i--) {
            const c = confetti[i];
            c.x += c.vx;
            c.y += c.vy;
            c.vy += 0.1; // Soft Gravity
            c.rotation += c.rotationSpeed;
            c.life -= 1;
            
            if (c.life <= 0) {
                confetti.splice(i, 1);
                continue;
            }
            
            ctx.save();
            ctx.translate(c.x, c.y);
            ctx.rotate(c.rotation);
            ctx.fillStyle = c.color;
            ctx.globalAlpha = Math.min(1, c.life / 30);
            ctx.fillRect(-c.width / 2, -c.height / 2, c.width, c.height);
            ctx.restore();
        }
        
        requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
}

function spawnMergeParticles(x, y, color) {
    if (particlesEnabled === 'off') return;
    const count = particlesEnabled === 'high' ? 18 : 8;
    for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 2 + Math.random() * 5;
        particles.push({
            x: x,
            y: y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed - 2, // Slight bias upward
            size: 4 + Math.random() * 6,
            color: color,
            alpha: 1
        });
    }
}

function triggerConfettiBurst() {
    const colors = ['#ff5e97', '#a15eff', '#00f0ff', '#ffea00', '#34d399', '#f43f5e'];
    for (let i = 0; i < 100; i++) {
        const x = canvas.width / 2;
        const y = canvas.height * 0.4;
        const angle = Math.random() * Math.PI * 2;
        const speed = 4 + Math.random() * 8;
        confetti.push({
            x: x,
            y: y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed - 5,
            width: 6 + Math.random() * 8,
            height: 10 + Math.random() * 8,
            color: colors[Math.floor(Math.random() * colors.length)],
            rotation: Math.random() * Math.PI,
            rotationSpeed: -0.1 + Math.random() * 0.2,
            life: 80 + Math.random() * 50
        });
    }
}

// --- Achievement Notification System ---
function unlockAchievement(id) {
    if (unlockedAchievements.includes(id)) return;
    
    const ach = ACHIEVEMENT_DEFS.find(a => a.id === id);
    if (!ach) return;
    
    unlockedAchievements.push(id);
    showToast('🏆 Achievement Unlocked!', `${ach.icon} ${ach.name} - ${ach.desc}`);
    
    // Play level up sound as a congratulations!
    playSynthesizedSound('levelup');
    saveGameData();
}

function showToast(title, body) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast';
    
    toast.innerHTML = `
        <span class="toast-icon">✨</span>
        <div class="toast-content">
            <span class="toast-title">${title}</span>
            <span class="toast-body">${body}</span>
        </div>
    `;
    
    container.appendChild(toast);
    
    // Automatic cleanup
    setTimeout(() => {
        toast.remove();
    }, 3200);
}

// --- Core Game Initialization & Loops ---
function startNewGame() {
    board = Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(0));
    score = 0;
    level = 1;
    xp = 0;
    xpNeeded = 500;
    combo = 1;
    isGameOver = false;
    isPaused = false;
    undoHistory = [];
    
    // Hide gameover & pause screens
    document.getElementById('overlay-gameover').classList.remove('active');
    document.getElementById('overlay-pause').classList.remove('active');
    
    // Mode specific random generators
    if (gameMode === 'daily') {
        const seed = getDailySeed();
        seedRandom(seed);
        document.getElementById('mode-text').innerText = `Daily Challenge (Seed: ${seed})`;
        unlockAchievement('daily_play');
    } else {
        document.getElementById('mode-text').innerText = "Endless Mode";
    }
    
    // Seed queue with 4 numbers
    queue = [];
    for (let i = 0; i < 4; i++) {
        queue.push(getRandomSpawnValue());
    }
    
    stats.gamesPlayed++;
    
    updateUI();
    renderBoard();
    saveGameData();
}

function getRandomSpawnValue() {
    // Generate spawn blocks. Standard starts with 2, 4, 8.
    // Spawn table increases as player climbs levels.
    let candidates = [2, 2, 2, 4, 4];
    
    if (level >= 2) candidates.push(8);
    if (level >= 3) candidates.push(16);
    if (level >= 5) candidates.push(32);
    if (level >= 8) candidates.push(64);
    
    // Seeded vs math random
    const rand = gameMode === 'daily' ? nextRandom() : Math.random();
    return candidates[Math.floor(rand * candidates.length)];
}

function advanceQueue() {
    // Shunt blocks to left
    queue.shift();
    // Add new random block to back
    queue.push(getRandomSpawnValue());
}

// Capture current game state for undo
function saveUndoState() {
    const boardCopy = board.map(row => [...row]);
    const queueCopy = [...queue];
    
    undoHistory.push({
        board: boardCopy,
        queue: queueCopy,
        score: score,
        level: level,
        xp: xp,
        xpNeeded: xpNeeded,
        combo: combo
    });
    
    if (undoHistory.length > MAX_UNDO_STATES) {
        undoHistory.shift();
    }
}

// Trigger undo action
function undoLastMove() {
    if (undoHistory.length === 0) {
        showToast('⏳ Undo', 'No moves left to undo!');
        return;
    }
    
    playSynthesizedSound('click');
    const previousState = undoHistory.pop();
    
    board = previousState.board;
    queue = previousState.queue;
    score = previousState.score;
    level = previousState.level;
    xp = previousState.xp;
    xpNeeded = previousState.xpNeeded;
    combo = previousState.combo;
    isGameOver = false;
    
    // Remove game over overlay if present
    document.getElementById('overlay-gameover').classList.remove('active');
    
    updateUI();
    renderBoard();
    unlockAchievement('undo_move');
    saveGameData();
}

// --- Grid Click Placement Mechanics ---
function placeBlock(row, col) {
    if (isGameOver || isPaused) return;
    if (board[row][col] !== 0) return; // Must be empty
    
    saveUndoState();
    
    const value = queue[0];
    board[row][col] = value;
    
    playSynthesizedSound('place');
    stats.totalMerges++; // Track stats block placements
    
    // Animate grid insertion
    renderBoard();
    
    // Advance queue
    advanceQueue();
    updateUI();
    
    // Trigger recursive check for adjacent merges
    combo = 1;
    handleGridMerges(row, col, value);
}

// Recursive/Iterative cascading merge detector
function handleGridMerges(row, col, value) {
    const visited = Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(false));
    const identicalGroup = [];
    
    // Helper BFS to find identical contiguous blocks
    function floodFill(r, c) {
        const targetValue = board[r][c];
        const queue = [[r, c]];
        visited[r][c] = true;
        
        while (queue.length > 0) {
            const [currR, currC] = queue.shift();
            identicalGroup.push([currR, currC]);
            
            const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
            for (const [dr, dc] of dirs) {
                const nextR = currR + dr;
                const nextC = currC + dc;
                
                if (nextR >= 0 && nextR < BOARD_SIZE && nextC >= 0 && nextC < BOARD_SIZE) {
                    if (!visited[nextR][nextC] && board[nextR][nextC] === targetValue && board[nextR][nextC] !== 0) {
                        visited[nextR][nextC] = true;
                        queue.push([nextR, nextC]);
                    }
                }
            }
        }
    }
    
    floodFill(row, col);
    
    if (identicalGroup.length >= 2) {
        // Achievement: first merge!
        unlockAchievement('first_merge');
        
        // Save target block DOM position to generate center coordinate for canvas particles
        const boardElem = document.getElementById('board');
        const targetCell = boardElem.querySelector(`[data-row="${row}"][data-col="${col}"]`);
        let particleX = canvas.width / 2;
        let particleY = canvas.height / 2;
        
        if (targetCell) {
            const rect = targetCell.getBoundingClientRect();
            const canvasRect = canvas.getBoundingClientRect();
            particleX = rect.left - canvasRect.left + rect.width / 2;
            particleY = rect.top - canvasRect.top + rect.height / 2;
        }
        
        // High Contrast Gradient Tile Color for Particles
        const blockColors = {
            2: '#ff8a9a', 4: '#ff5376', 8: '#ff8235', 16: '#f7b131', 32: '#10b981',
            64: '#06b6d4', 128: '#3b82f6', 256: '#6366f1', 512: '#8b5cf6',
            1024: '#ec4899', 2048: '#f43f5e', 4096: '#e11d48', 8192: '#00f0ff'
        };
        const pColor = blockColors[value] || '#00f0ff';
        
        // Close Call Achievement: Merge when grid is 90% full (32 cells or more occupied)
        let occupiedCells = 0;
        for (let r = 0; r < BOARD_SIZE; r++) {
            for (let c = 0; c < BOARD_SIZE; c++) {
                if (board[r][c] !== 0) occupiedCells++;
            }
        }
        if (occupiedCells >= 32) {
            unlockAchievement('board_full_save');
        }

        // Trigger slide visual transitions
        identicalGroup.forEach(([r, c]) => {
            if (r === row && c === col) return;
            
            // Visual slider overlay
            const tileDiv = document.querySelector(`.tile-block[data-row="${r}"][data-col="${c}"]`);
            if (tileDiv) {
                // Change style positions to collapse to final cell
                const colDiff = col - c;
                const rowDiff = row - r;
                tileDiv.style.transform += ` translate(${colDiff * 105}%, ${rowDiff * 105}%) scale(0.6)`;
                tileDiv.style.opacity = '0';
                tileDiv.style.zIndex = '5';
            }
            
            // Wipe from board
            board[r][c] = 0;
        });
        
        // Wait for visual collapse slide transition to complete
        setTimeout(() => {
            // Merge score calculation with combos
            const pointsGained = value * identicalGroup.length * combo;
            score += pointsGained;
            
            // Trigger score floating popups
            triggerScorePopup(pointsGained);
            
            // Upgrade target cell value
            const nextVal = value * 2;
            board[row][col] = nextVal;
            
            // Stats updates
            if (nextVal > stats.highestBlock) {
                stats.highestBlock = nextVal;
                // Achievement milestones
                if (nextVal >= 128) unlockAchievement('block_128');
                if (nextVal >= 1024) unlockAchievement('block_1024');
                if (nextVal >= 2048) {
                    unlockAchievement('block_2048');
                    triggerConfettiBurst(); // Celebrate the 2048 milestone!
                }
                if (nextVal >= 8192) unlockAchievement('block_8192');
            }
            
            // XP & Levelling Progression
            xp += Math.floor(pointsGained / 2);
            if (xp >= xpNeeded) {
                levelUp();
            }
            
            // Particles
            spawnMergeParticles(particleX, particleY, pColor);
            
            // Sound effects
            const pitchLevel = Math.min(2.5, 0.8 + (combo * 0.15) + (NUMBERS_SEQUENCE.indexOf(value) * 0.1));
            if (combo >= 2) {
                playSynthesizedSound('combo', pitchLevel);
                triggerComboFloatingText();
            } else {
                playSynthesizedSound('merge', pitchLevel);
            }
            
            // Render board to center the newly merged tile
            renderBoard();
            
            // Add pulse to the merged cell
            const mergedTile = document.querySelector(`.tile-block[data-row="${row}"][data-col="${col}"]`);
            if (mergedTile) {
                mergedTile.classList.add('pulse');
            }
            
            // Recurse after merge complete to verify cascade chain reactions
            setTimeout(() => {
                combo++;
                if (combo > stats.maxCombo) {
                    stats.maxCombo = combo;
                    if (combo >= 3) unlockAchievement('combo_3');
                }
                handleGridMerges(row, col, nextVal);
            }, 180);
            
        }, 180);
    } else {
        // No merges took place. Check gameover and end turn.
        checkGameOver();
    }
}

// Level-up mechanic
function levelUp() {
    level++;
    xp -= xpNeeded;
    xpNeeded = level * 500;
    
    playSynthesizedSound('levelup');
    showToast('🌟 LEVEL UP!', `Congratulations, you reached Level ${level}! Maximum blocks upgraded.`);
    
    if (level >= 5) {
        unlockAchievement('level_5');
    }
    
    triggerConfettiBurst();
    updateUI();
}

function triggerScorePopup(pts) {
    const popup = document.getElementById('score-popup');
    popup.innerText = `+${pts}`;
    
    // Reset element animation
    popup.style.animation = 'none';
    popup.offsetHeight; // trigger reflow
    popup.style.animation = null;
}

function triggerComboFloatingText() {
    const display = document.getElementById('combo-display');
    display.innerText = `${combo}x COMBO!`;
    display.className = 'combo-text active';
    
    setTimeout(() => {
        display.className = 'combo-text';
    }, 800);
}

// Check if game over condition met (no empty cells remaining on board)
function checkGameOver() {
    let emptyCells = 0;
    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            if (board[r][c] === 0) emptyCells++;
        }
    }
    
    if (emptyCells === 0) {
        // Game Over! Trigger Board shaking animation
        document.getElementById('board').parentElement.classList.add('shake');
        playSynthesizedSound('gameover');
        
        setTimeout(() => {
            document.getElementById('board').parentElement.classList.remove('shake');
            endGame();
        }, 600);
    } else {
        // Game is safe, save state to cache
        saveGameData();
    }
}

function endGame() {
    isGameOver = true;
    
    // High Score logic
    if (score > bestScore) {
        bestScore = score;
    }
    
    if (gameMode === 'daily' && score > stats.dailyBest) {
        stats.dailyBest = score;
    }
    
    // Open Game Over panel
    document.getElementById('overlay-gameover').classList.add('active');
    document.getElementById('go-score').innerText = score;
    
    // Find highest block on board
    let highestOnBoard = 2;
    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            if (board[r][c] > highestOnBoard) highestOnBoard = board[r][c];
        }
    }
    document.getElementById('go-block').innerText = highestOnBoard;
    
    saveGameData();
}

// --- UI rendering and manipulation ---
function updateUI() {
    document.getElementById('current-score').innerText = score;
    document.getElementById('best-score').innerText = bestScore;
    document.getElementById('current-level').innerText = level;
    
    const xpPercent = Math.min(100, (xp / xpNeeded) * 100);
    document.getElementById('xp-bar-fill').style.width = `${xpPercent}%`;
    
    // Render Queue Slots
    renderBlockPreview('block-current', queue[0]);
    renderBlockPreview('block-next-1', queue[1]);
    renderBlockPreview('block-next-2', queue[2]);
    renderBlockPreview('block-next-3', queue[3]);
}

function renderBlockPreview(elementId, value) {
    const elem = document.getElementById(elementId);
    if (!elem) return;
    
    elem.className = `block-preview tile-${value}`;
    elem.innerText = value;
}

function renderBoard() {
    const boardElem = document.getElementById('board');
    boardElem.innerHTML = '';
    
    // Generate static structural grid background
    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            const cell = document.createElement('div');
            cell.className = 'grid-cell';
            cell.setAttribute('data-row', r);
            cell.setAttribute('data-col', c);
            
            // Tap placement listeners
            cell.addEventListener('click', () => placeBlock(r, c));
            
            // Drag-over event handles
            cell.addEventListener('dragover', (e) => {
                e.preventDefault();
                if (board[r][c] === 0) {
                    cell.classList.add('drag-over');
                    currentDragOverCell = { row: r, col: c };
                }
            });
            
            cell.addEventListener('dragleave', () => {
                cell.classList.remove('drag-over');
                currentDragOverCell = null;
            });
            
            cell.addEventListener('drop', (e) => {
                e.preventDefault();
                cell.classList.remove('drag-over');
                if (board[r][c] === 0) {
                    placeBlock(r, c);
                }
                currentDragOverCell = null;
            });
            
            boardElem.appendChild(cell);
        }
    }
    
    // Layer and absolute overlay tiles
    const rect = boardElem.getBoundingClientRect();
    const cellSize = (rect.width - 30) / 6; // Standard cell size
    const gap = 6;
    
    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            const val = board[r][c];
            if (val !== 0) {
                const tile = document.createElement('div');
                tile.className = `tile-block tile-${val} spawn`;
                tile.innerText = val;
                tile.setAttribute('data-row', r);
                tile.setAttribute('data-col', c);
                
                // Absolute positions relative to board dimensions
                tile.style.top = `${r * (100 / BOARD_SIZE)}%`;
                tile.style.left = `${c * (100 / BOARD_SIZE)}%`;
                tile.style.width = `calc(${100 / BOARD_SIZE}% - ${gap}px)`;
                tile.style.height = `calc(${100 / BOARD_SIZE}% - ${gap}px)`;
                tile.style.margin = `${gap / 2}px`;
                
                tile.addEventListener('click', () => {
                    // Let clicking block place on top or handle cascades
                });
                
                boardElem.appendChild(tile);
            }
        }
    }
}

// --- Drag & Drop Mechanics Implementation ---
function setupDragAndDrop() {
    const slotCurrent = document.getElementById('slot-current');
    const dragGhost = document.getElementById('drag-ghost');
    
    // Mouse Support
    slotCurrent.addEventListener('mousedown', (e) => {
        if (isGameOver || isPaused) return;
        initAudio();
        startDrag(e.clientX, e.clientY);
    });
    
    window.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        updateDrag(e.clientX, e.clientY);
    });
    
    window.addEventListener('mouseup', () => {
        if (!isDragging) return;
        endDrag();
    });
    
    // Mobile Touch Support
    slotCurrent.addEventListener('touchstart', (e) => {
        if (isGameOver || isPaused) return;
        initAudio();
        const touch = e.touches[0];
        startDrag(touch.clientX, touch.clientY);
    }, { passive: true });
    
    window.addEventListener('touchmove', (e) => {
        if (!isDragging) return;
        const touch = e.touches[0];
        updateDrag(touch.clientX, touch.clientY);
        
        // Custom collision check to find matching cell during touch drag
        const element = document.elementFromPoint(touch.clientX, touch.clientY);
        if (element && element.classList.contains('grid-cell')) {
            const r = parseInt(element.getAttribute('data-row'));
            const c = parseInt(element.getAttribute('data-col'));
            
            // Clear prior highlights
            document.querySelectorAll('.grid-cell').forEach(cell => cell.classList.remove('drag-over'));
            
            if (board[r][c] === 0) {
                element.classList.add('drag-over');
                currentDragOverCell = { row: r, col: c };
            }
        } else {
            document.querySelectorAll('.grid-cell').forEach(cell => cell.classList.remove('drag-over'));
            currentDragOverCell = null;
        }
    }, { passive: false });
    
    window.addEventListener('touchend', () => {
        if (!isDragging) return;
        endDrag();
    });
}

function startDrag(clientX, clientY) {
    isDragging = true;
    const value = queue[0];
    
    const dragGhost = document.getElementById('drag-ghost');
    dragGhost.style.display = 'flex';
    dragGhost.innerText = value;
    dragGhost.className = `drag-ghost tile-${value}`;
    dragGhost.style.left = `${clientX}px`;
    dragGhost.style.top = `${clientY}px`;
    
    // Dim the preview
    document.getElementById('block-current').style.opacity = '0.3';
}

function updateDrag(clientX, clientY) {
    const dragGhost = document.getElementById('drag-ghost');
    dragGhost.style.left = `${clientX}px`;
    dragGhost.style.top = `${clientY}px`;
}

function endDrag() {
    isDragging = false;
    const dragGhost = document.getElementById('drag-ghost');
    dragGhost.style.display = 'none';
    
    // Reset opacity
    document.getElementById('block-current').style.opacity = '1';
    
    // Clear highlights
    document.querySelectorAll('.grid-cell').forEach(cell => cell.classList.remove('drag-over'));
    
    if (currentDragOverCell) {
        placeBlock(currentDragOverCell.row, currentDragOverCell.col);
    }
    
    currentDragOverCell = null;
}

// --- Tab Navigation Handlers ---
function setupTabNavigation() {
    const tabs = {
        'tab-endless': () => {
            if (gameMode !== 'endless') {
                gameMode = 'endless';
                localStorage.removeItem('m6x6_autosave');
                startNewGame();
            }
        },
        'tab-daily': () => {
            if (gameMode !== 'daily') {
                gameMode = 'daily';
                startNewGame();
            }
        },
        'tab-stats': () => openModal('modal-stats'),
        'tab-achievements': () => openModal('modal-achievements'),
        'tab-settings': () => openModal('modal-settings')
    };
    
    Object.keys(tabs).forEach(id => {
        const btn = document.getElementById(id);
        btn.addEventListener('click', () => {
            playSynthesizedSound('click');
            
            // Switch active tab styling
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            if (id === 'tab-endless' || id === 'tab-daily') {
                btn.classList.add('active');
            } else {
                // Return active state to game mode tab
                const modeTabId = gameMode === 'endless' ? 'tab-endless' : 'tab-daily';
                document.getElementById(modeTabId).classList.add('active');
            }
            
            tabs[id]();
        });
    });
}

// --- Modal Handlers ---
function openModal(id) {
    initAudio();
    const modal = document.getElementById(id);
    modal.classList.add('active');
    
    if (id === 'modal-stats') {
        renderStatistics();
    } else if (id === 'modal-achievements') {
        renderAchievements();
    } else if (id === 'modal-settings') {
        renderSettings();
    }
}

function closeModal(modal) {
    modal.classList.remove('active');
}

function setupModalListeners() {
    document.querySelectorAll('.modal').forEach(modal => {
        // Close on X click
        modal.querySelector('.modal-close').addEventListener('click', () => {
            playSynthesizedSound('click');
            closeModal(modal);
        });
        
        // Close on background blur click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                playSynthesizedSound('click');
                closeModal(modal);
            }
        });
    });
}

function renderStatistics() {
    document.getElementById('stat-games-played').innerText = stats.gamesPlayed;
    document.getElementById('stat-total-merges').innerText = stats.totalMerges;
    document.getElementById('stat-highest-block').innerText = stats.highestBlock;
    document.getElementById('stat-max-combo').innerText = `${stats.maxCombo}x`;
    document.getElementById('stat-daily-high').innerText = stats.dailyBest;
}

function renderAchievements() {
    const container = document.getElementById('achievements-container');
    container.innerHTML = '';
    
    ACHIEVEMENT_DEFS.forEach(ach => {
        const isUnlocked = unlockedAchievements.includes(ach.id);
        const item = document.createElement('div');
        item.className = `ach-item ${isUnlocked ? 'unlocked' : 'locked'}`;
        
        item.innerHTML = `
            <div class="ach-icon">${isUnlocked ? ach.icon : '🔒'}</div>
            <div class="ach-info">
                <span class="ach-name">${ach.name}</span>
                <span class="ach-desc">${ach.desc}</span>
            </div>
        `;
        
        container.appendChild(item);
    });
}

function renderSettings() {
    // Sync buttons
    document.querySelectorAll('.theme-opt').forEach(opt => {
        opt.classList.toggle('active', opt.getAttribute('data-theme') === currentTheme);
    });
    
    document.querySelectorAll('.part-opt').forEach(opt => {
        opt.classList.toggle('active', opt.getAttribute('data-intensity') === particlesEnabled);
    });
}

function setupSettingsListeners() {
    document.querySelectorAll('.theme-opt').forEach(opt => {
        opt.addEventListener('click', () => {
            playSynthesizedSound('click');
            currentTheme = opt.getAttribute('data-theme');
            document.body.setAttribute('data-active-theme', currentTheme);
            renderSettings();
            saveGameData();
        });
    });
    
    document.querySelectorAll('.part-opt').forEach(opt => {
        opt.addEventListener('click', () => {
            playSynthesizedSound('click');
            particlesEnabled = opt.getAttribute('data-intensity');
            renderSettings();
            saveGameData();
        });
    });
    
    document.getElementById('btn-reset-data').addEventListener('click', () => {
        if (confirm("Are you sure you want to reset all high scores, achievements, and statistics? This cannot be undone.")) {
            resetAllData();
            // Close setting modal
            closeModal(document.getElementById('modal-settings'));
        }
    });
}

// --- Primary Control Actions Setup ---
function setupControlListeners() {
    // Restart
    document.getElementById('btn-restart').addEventListener('click', () => {
        playSynthesizedSound('click');
        if (confirm("Restart game? Your current score progress will be lost.")) {
            startNewGame();
        }
    });
    
    document.getElementById('btn-go-restart').addEventListener('click', () => {
        playSynthesizedSound('click');
        startNewGame();
    });
    
    // Pause
    document.getElementById('btn-pause').addEventListener('click', () => {
        playSynthesizedSound('click');
        isPaused = true;
        document.getElementById('overlay-pause').classList.add('active');
    });
    
    document.getElementById('btn-resume').addEventListener('click', () => {
        playSynthesizedSound('click');
        isPaused = false;
        document.getElementById('overlay-pause').classList.remove('active');
    });
    
    // Undo
    document.getElementById('btn-undo').addEventListener('click', () => {
        undoLastMove();
    });
    
    // Sound Toggle
    const soundBtn = document.getElementById('btn-sound');
    soundBtn.addEventListener('click', () => {
        soundEnabled = !soundEnabled;
        const icon = document.getElementById('sound-icon');
        icon.innerText = soundEnabled ? '🔊' : '🔇';
        
        if (soundEnabled) {
            initAudio();
            playSynthesizedSound('click');
        }
        saveGameData();
    });
}

// Keyboard arrow controls for moving drag element or clicking
function setupKeyboardControls() {
    window.addEventListener('keydown', (e) => {
        if (isGameOver || isPaused) return;
        
        // Escape to pause
        if (e.key === 'Escape') {
            isPaused = !isPaused;
            document.getElementById('overlay-pause').classList.toggle('active', isPaused);
            playSynthesizedSound('click');
        }
    });
}

// --- Document Ready / DOM Loaded Entrypoint ---
document.addEventListener('DOMContentLoaded', () => {
    // Load local high scores, settings
    loadGameData();
    
    // Visual Canvas Config
    setupCanvas();
    
    // Handlers
    setupDragAndDrop();
    setupTabNavigation();
    setupModalListeners();
    setupSettingsListeners();
    setupControlListeners();
    setupKeyboardControls();
});
