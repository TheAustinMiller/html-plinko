const payouts = [14, 7, 3.5, 1.8, 0.2, 0, 0.2, 1.8, 3.5, 7, 14];

const canvas = document.getElementById('plinko');
const ctx = canvas.getContext('2d');

const rows = 10;
const slots = rows + 1;
const slotWidth = 64;
const pegSpacing = 60;
const topMargin = 96;
const ballRadius = 9;
const dropSpeed = 2.8;
const horizEase = 0.22;
const settledDisplayMs = 1200;

let balance = 0;
let bet = 10;
const minBet = 1;
const maxBet = 100;

const centerX = canvas.width / 2;
const slotsTotalWidth = slots * slotWidth;
const startX = centerX - slotsTotalWidth / 2;
const floorY = canvas.height - 100;

const pegs = [];
for (let r = 0; r < rows; r++) {
    const y = topMargin + r * pegSpacing;
    const rowCount = r + 1;
    const rowWidth = rowCount * slotWidth;
    const rowOffset = (slotsTotalWidth - rowWidth) / 2;
    const row = [];
    for (let i = 0; i < rowCount; i++) {
        const x = startX + rowOffset + i * slotWidth + slotWidth / 2;
        row.push({ x, y });
    }
    pegs.push(row);
}

let balls = [];
let nextBallId = 1;
let lastWin = 0;
let lastMultiplier = 0;
let lastHighlight = { slot: null, until: 0 };

const balanceEl = document.getElementById('balance');
const lastWinEl = document.getElementById('lastWin');
const betAmountEl = document.getElementById('betAmount');
const dropBtn = document.getElementById('dropBtn');
const decreaseBetBtn = document.getElementById('decreaseBet');
const increaseBetBtn = document.getElementById('increaseBet');

dropBtn.addEventListener('click', () => dropBall());
decreaseBetBtn.addEventListener('click', () => changeBet(-1));
increaseBetBtn.addEventListener('click', () => changeBet(1));
adBtn.addEventListener('click', () => playAd());

function playAd() {
    // Create overlay
    const overlay = document.createElement('div');
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.9);
        z-index: 9999;
        display: flex;
        align-items: center;
        justify-content: center;
    `;

    // Create video element
    const video = document.createElement('video');
    video.src = 'ad.mp4'; // Replace with your video file
    video.style.cssText = `
        width: 80%;
        max-width: 800px;
        height: auto;
    `;
    video.autoplay = true;
    video.muted = false;
    video.controls = false;

    // Disable right-click
    video.addEventListener('contextmenu', (e) => e.preventDefault());
    
    // Prevent keyboard shortcuts
    const blockKeys = (e) => {
        e.preventDefault();
        e.stopPropagation();
        return false;
    };

    // Block common escape keys
    document.addEventListener('keydown', blockKeys);
    
    // Remove overlay when video ends
    video.addEventListener('ended', () => {
        document.body.removeChild(overlay);
        document.removeEventListener('keydown', blockKeys);
    });

    // Prevent overlay clicks
    overlay.addEventListener('click', (e) => e.stopPropagation());

    // Add video to overlay and overlay to page
    overlay.appendChild(video);
    document.body.appendChild(overlay);

    balance = 100;
    lastWin = 0;
    lastMultiplier = 0;
    updateHUD();
}

function changeBet(direction) {
    if (direction > 0) {
        bet = Math.min(bet + 1, maxBet, balance);
    } else {
        bet = Math.max(bet - 1, minBet);
    }
    updateHUD();
}

function updateHUD() {
    balanceEl.textContent = `Balance: $${balance}`;
    lastWinEl.textContent = `Last Win: ${lastMultiplier}x ($${lastWin})`;
    betAmountEl.textContent = `$${bet}`;
    dropBtn.textContent = `Drop Ball ($${bet})`;
    if (balance === 0) {
        adBtn.style.display = 'inline-block';
        dropBtn.disabled = true;
        decreaseBetBtn.disabled = true;
        increaseBetBtn.disabled = true;
    }
    if (balance > 0) {
        adBtn.style.display = 'none';
        dropBtn.disabled = false;
        decreaseBetBtn.disabled = false;
        increaseBetBtn.disabled = false;
    }
}

function clamp(v, a, b) { 
    return Math.max(a, Math.min(b, v)); 
}

function dropBall() {
    if (balance < bet) {
        alert("Not enough balance.");
        return;
    }
    balance -= bet;
    updateHUD();

    const id = nextBallId++;
    balls.push({
        id,
        x: centerX,
        y: 44,
        row: 0,
        net: 0,
        targetX: centerX,
        moving: true,
        settled: false,
        settledAt: null
    });
}

function updateBalls(now) {
    for (const b of balls) {
        if (!b.moving) continue;

        b.y += dropSpeed;

        const nextRowY = topMargin + b.row * pegSpacing;
        if (b.row < rows && b.y >= nextRowY) {
            const goRight = Math.random() < 0.5;
            b.net += goRight ? 1 : -1;
            b.targetX = centerX + (b.net * (slotWidth / 2));
            b.row++;
        }

        b.x += (b.targetX - b.x) * horizEase;

        if (b.row >= rows && b.y >= floorY - 6 && !b.settled) {
            b.moving = false;
            b.settled = true;
            b.settledAt = performance.now();

            let slotIndex = Math.round((b.net + rows) / 2);
            slotIndex = clamp(slotIndex, 0, slots - 1);

            b.x = startX + slotIndex * slotWidth + slotWidth / 2;
            b.y = floorY - (ballRadius + 6);

            const multiplier = payouts[slotIndex];
            const win = bet * multiplier;
            balance += win;
            lastWin = win;
            lastMultiplier = multiplier;
            lastHighlight.slot = slotIndex;
            lastHighlight.until = performance.now() + 900;

            updateHUD();

            ((id) => {
                setTimeout(() => {
                    balls = balls.filter(bb => bb.id !== id);
                }, settledDisplayMs);
            })(b.id);
        }
    }
}

function drawBoard(now) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const g = ctx.createLinearGradient(0, 0, 0, canvas.height);
    g.addColorStop(0, "#061017");
    g.addColorStop(1, "#001217");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#ffffff';
    for (const row of pegs) {
        for (const p of row) {
            ctx.beginPath();
            ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    ctx.save();
    ctx.strokeStyle = "#00ff88";
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.98;
    for (let j = 0; j <= slots; j++) {
        const x = startX + j * slotWidth;
        ctx.beginPath();
        ctx.moveTo(x, floorY - 8);
        ctx.lineTo(x, canvas.height - 18);
        ctx.stroke();
    }
    ctx.restore();

    if (lastHighlight.slot !== null && performance.now() < lastHighlight.until) {
        const s = lastHighlight.slot;
        const cx = startX + s * slotWidth + slotWidth / 2;
        ctx.save();
        ctx.fillStyle = "rgba(0,255,136,0.12)";
        ctx.fillRect(cx - slotWidth / 2 + 3, floorY - 68, slotWidth - 6, 78);
        ctx.restore();
    }

    ctx.fillStyle = '#001a10';
    ctx.fillRect(startX + 2, floorY + 18, slots * slotWidth - 4, 10);
    ctx.font = "15px monospace";
    ctx.textAlign = 'center';
    for (let i = 0; i < slots; i++) {
        const cx = startX + i * slotWidth + slotWidth / 2;
        ctx.fillStyle = '#bfffd3';
        ctx.fillText(`${payouts[i]}x`, cx, canvas.height - 28);
    }
}

function drawBalls() {
    for (const b of balls) {
        ctx.beginPath();
        const grd = ctx.createRadialGradient(b.x - 4, b.y - 4, 2, b.x, b.y, ballRadius + 6);
        grd.addColorStop(0, "rgba(255,140,120,1)");
        grd.addColorStop(1, "rgba(220,40,40,0.7)");
        ctx.fillStyle = grd;
        ctx.arc(b.x, b.y, ballRadius, 0, Math.PI * 2);
        ctx.fill();

        ctx.beginPath();
        ctx.fillStyle = 'rgba(255,255,255,0.75)';
        ctx.arc(b.x - 3, b.y - 5, 2.2, 0, Math.PI * 2);
        ctx.fill();
    }
}

function loop(now) {
    updateBalls(now);
    drawBoard(now);
    drawBalls();
    requestAnimationFrame(loop);
}

updateHUD();
requestAnimationFrame(loop);