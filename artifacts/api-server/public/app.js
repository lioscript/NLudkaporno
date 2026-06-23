/* NFT Gift Upgrader — Mini App */

const tg = window.Telegram?.WebApp;
if (tg) {
  tg.expand();
  tg.setHeaderColor('#0a0a0f');
  tg.setBackgroundColor('#0a0a0f');
}

const BASE = '';
let allGifts = [];

// ─── Placeholder image generator ─────────────────────────────────────────────
const placeholderCache = {};
function getPlaceholder(name) {
  if (placeholderCache[name]) return placeholderCache[name];
  const colors = [
    ['#7c3aed','#a855f7'], ['#db2777','#f472b6'], ['#0891b2','#22d3ee'],
    ['#059669','#34d399'], ['#d97706','#fbbf24'], ['#dc2626','#f87171'],
    ['#7c3aed','#ec4899'], ['#0ea5e9','#818cf8'],
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) & 0xffff;
  const [c1, c2] = colors[hash % colors.length];
  const initials = name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
  const c = document.createElement('canvas');
  c.width = 80; c.height = 80;
  const ctx = c.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 80, 80);
  grad.addColorStop(0, c1); grad.addColorStop(1, c2);
  ctx.fillStyle = grad;
  ctx.roundRect(0, 0, 80, 80, 12);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.font = 'bold 26px -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(initials, 40, 40);
  const url = c.toDataURL();
  placeholderCache[name] = url;
  return url;
}

function imgWithFallback(src, name, cls = '') {
  return `<img src="${src}" alt="${name}" class="${cls}" onerror="this.src=getPlaceholder('${name.replace(/'/g,"\\'")}');this.onerror=null" />`;
}
let myInventory = [];
let betGift = null;
let targetGift = null;
let isSpinning = false;
let currentNeedleRotation = 0;

// ─── Init ───────────────────────────────────────────────────────────────────

async function init() {
  setupUserInfo();
  await Promise.all([loadGifts(), loadInventory()]);
  initSpinner();
}

function getInitData() {
  if (tg?.initData) return tg.initData;
  // Dev fallback
  return 'user=%7B%22id%22%3A1%2C%22first_name%22%3A%22Dev%22%7D&hash=dev';
}

function setupUserInfo() {
  if (!tg?.initDataUnsafe?.user) return;
  const user = tg.initDataUnsafe.user;
  document.getElementById('userName').textContent = user.first_name + (user.last_name ? ' ' + user.last_name : '');
  if (user.photo_url) {
    const avatarEl = document.getElementById('userAvatar');
    avatarEl.innerHTML = `<img src="${user.photo_url}" alt="" />`;
  }
}

// ─── Data Loading ───────────────────────────────────────────────────────────

async function loadGifts() {
  try {
    const res = await fetch(`${BASE}/api/gifts`);
    allGifts = await res.json();
  } catch (e) {
    console.error('Failed to load gifts', e);
  }
}

async function loadInventory() {
  try {
    const initData = encodeURIComponent(getInitData());
    const res = await fetch(`${BASE}/api/inventory?initData=${initData}`);
    const data = await res.json();
    myInventory = data.inventory || [];
    updateInventoryCount();
  } catch (e) {
    console.error('Failed to load inventory', e);
  }
}

function updateInventoryCount() {
  document.getElementById('invCount').textContent = myInventory.length;
}

// ─── Spinner ────────────────────────────────────────────────────────────────

const SPIN_R = 125;
const SPIN_C = 2 * Math.PI * SPIN_R; // ≈ 785.4

function initSpinner() {
  drawTicks();
  drawWinArc(0);
  document.getElementById('spinnerSvg').classList.add('idle');
}

function drawTicks() {
  const g = document.getElementById('tickMarks');
  if (!g) return;
  g.innerHTML = '';
  const cx = 150, cy = 150;
  for (let i = 0; i < 60; i++) {
    const rad = ((i / 60) * 360 - 90) * Math.PI / 180;
    const long = i % 5 === 0;
    const r1 = SPIN_R - 14 + (long ? 0 : 3);
    const r2 = r1 - (long ? 7 : 4);
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', (cx + r1 * Math.cos(rad)).toFixed(2));
    line.setAttribute('y1', (cy + r1 * Math.sin(rad)).toFixed(2));
    line.setAttribute('x2', (cx + r2 * Math.cos(rad)).toFixed(2));
    line.setAttribute('y2', (cy + r2 * Math.sin(rad)).toFixed(2));
    line.setAttribute('stroke', long ? '#2e2e44' : '#232336');
    line.setAttribute('stroke-width', long ? '1.5' : '1');
    g.appendChild(line);
  }
}

function drawWinArc(chance) {
  const arc = document.getElementById('winArc');
  if (!arc) return;
  if (chance <= 0) {
    arc.setAttribute('opacity', '0');
    return;
  }
  arc.setAttribute('opacity', '1');
  const arcLen = (chance / 100) * SPIN_C;
  const gapLen = SPIN_C - arcLen;
  // Center arc at bottom (6 o'clock). dashoffset formula: (3C/4 + arcLen/2) % C
  const dashoffset = ((SPIN_C * 3 / 4) + arcLen / 2) % SPIN_C;
  arc.setAttribute('stroke-dasharray', `${arcLen.toFixed(2)} ${gapLen.toFixed(2)}`);
  arc.setAttribute('stroke-dashoffset', dashoffset.toFixed(2));
}

function encodeImageName(imagePath) {
  const filename = imagePath.split('/').pop();
  // Use relative path so proxy prefix is preserved (resolves to /api/images/...)
  return `images/${filename}`;
}

async function spinWheel(win, chance) {
  const needle = document.getElementById('needle');
  const svg = document.getElementById('spinnerSvg');
  svg.classList.remove('idle');

  const winHalf = (chance / 100) * 180; // half-angle of win zone in degrees
  const spins = (6 + Math.floor(Math.random() * 4)) * 360;

  let finalAngle;
  if (win) {
    // Land inside win zone (centered at 0°/down), with small margin
    finalAngle = (Math.random() * 2 - 1) * winHalf * 0.82;
  } else {
    // Land in lose zone (centered opposite at 180°), with spread
    const loseHalf = Math.max((180 - winHalf) * 0.75, 10);
    finalAngle = 180 + (Math.random() * 2 - 1) * loseHalf;
  }

  currentNeedleRotation += spins + finalAngle;
  needle.style.transition = 'transform 4s cubic-bezier(0.12, 0, 0.05, 1)';
  needle.style.transform = `rotate(${currentNeedleRotation}deg)`;

  await sleep(4300);
  svg.classList.add('idle');
}

// ─── Upgrade ─────────────────────────────────────────────────────────────────

async function doUpgrade() {
  if (isSpinning || !betGift || !targetGift) return;

  isSpinning = true;
  const btn = document.getElementById('upgradeBtn');
  btn.disabled = true;
  btn.classList.add('spinning');
  btn.textContent = '...';

  try {
    const res = await fetch(`${BASE}/api/upgrade`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        initData: getInitData(),
        betGiftName: betGift.name,
        targetGiftName: targetGift.name,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      alert(data.error || 'Upgrade failed');
      resetSpinState();
      return;
    }

    btn.textContent = 'SPINNING';

    // Spin wheel animation
    await spinWheel(data.win, data.chance);

    // Update inventory
    myInventory = data.newInventory || [];
    updateInventoryCount();

    // Show result
    showResult(data.win, data.chance);

    // Reset selection
    betGift = null;
    targetGift = null;
    renderBetDisplay();
    renderTargetDisplay();
    updateChance();

  } catch (e) {
    console.error(e);
    alert('Network error, please try again');
  } finally {
    resetSpinState();
  }
}

function resetSpinState() {
  isSpinning = false;
  const btn = document.getElementById('upgradeBtn');
  btn.classList.remove('spinning');
  btn.textContent = 'UPGRADE';
  updateUpgradeBtn();
}

// ─── Result ───────────────────────────────────────────────────────────────────

function showResult(win, chance) {
  const overlay = document.getElementById('resultOverlay');
  const icon = document.getElementById('resultIcon');
  const title = document.getElementById('resultTitle');
  const giftEl = document.getElementById('resultGift');

  if (win) {
    icon.textContent = '🎉';
    title.textContent = 'YOU WIN!';
    title.className = 'result-title win';
    giftEl.textContent = `You got: ${targetGift?.name || ''}`;
    spawnConfetti();
    document.getElementById('app').classList.add('win-flash');
    setTimeout(() => document.getElementById('app').classList.remove('win-flash'), 500);
  } else {
    icon.textContent = '💔';
    title.textContent = 'YOU LOSE';
    title.className = 'result-title lose';
    giftEl.textContent = `Better luck next time (${chance}% chance)`;
    document.getElementById('app').classList.add('lose-flash');
    setTimeout(() => document.getElementById('app').classList.remove('lose-flash'), 500);
  }

  overlay.classList.add('show');
}

function closeResult() {
  document.getElementById('resultOverlay').classList.remove('show');
}

// ─── Selection ───────────────────────────────────────────────────────────────

function renderBetDisplay() {
  const el = document.getElementById('betDisplay');
  const priceEl = document.getElementById('betPrice');

  if (betGift) {
    el.className = 'selected-gift has-gift';
    el.innerHTML = imgWithFallback(encodeImageName(betGift.image), betGift.name);
    priceEl.textContent = `⭐ ${betGift.price.toLocaleString()}`;
  } else {
    el.className = 'selected-gift';
    el.innerHTML = `<div class="gift-placeholder"><div class="plus-icon">＋</div><div class="placeholder-text">Select gift</div></div>`;
    priceEl.textContent = '';
  }
}

function renderTargetDisplay() {
  const el = document.getElementById('targetDisplay');
  const priceEl = document.getElementById('targetPrice');

  if (targetGift) {
    el.className = 'selected-gift has-gift';
    el.innerHTML = imgWithFallback(encodeImageName(targetGift.image), targetGift.name);
    priceEl.textContent = `⭐ ${targetGift.price.toLocaleString()}`;
  } else {
    el.className = 'selected-gift';
    el.innerHTML = `<div class="gift-placeholder"><div class="plus-icon">＋</div><div class="placeholder-text">Select gift</div></div>`;
    priceEl.textContent = '';
  }
}

function updateChance() {
  const el = document.getElementById('chanceValue');
  if (betGift && targetGift && betGift.price < targetGift.price) {
    const c = Math.min((betGift.price / targetGift.price) * 82, 82);
    el.textContent = c.toFixed(1) + '%';
    drawWinArc(c);
  } else {
    el.textContent = '—';
    drawWinArc(0);
  }
}

function updateUpgradeBtn() {
  const btn = document.getElementById('upgradeBtn');
  const canUpgrade = betGift && targetGift && betGift.price < targetGift.price && !isSpinning;
  btn.disabled = !canUpgrade;
}

// ─── Modals ───────────────────────────────────────────────────────────────────

function openBetModal() {
  if (isSpinning) return;
  const body = document.getElementById('betModalBody');
  body.innerHTML = '';

  if (myInventory.length === 0) {
    body.innerHTML = `<div class="empty-state"><div class="empty-icon">🎁</div><p>Your inventory is empty</p><p style="font-size:12px;margin-top:6px;color:#475569">Ask an admin to give you gifts to get started</p></div>`;
  } else {
    const grid = document.createElement('div');
    grid.className = 'gift-grid';
    for (const g of myInventory) {
      grid.appendChild(makeBetCard(g));
    }
    body.appendChild(grid);
  }

  openModal('betModal');
}

function makeBetCard(g) {
  const card = document.createElement('div');
  card.className = 'gift-card' + (betGift?.name === g.name ? ' selected' : '');
  card.innerHTML = `
    ${imgWithFallback(encodeImageName(g.image), g.name)}
    <span class="card-name">${g.name}</span>
    <span class="card-price">⭐ ${g.price?.toLocaleString?.() || g.price}</span>
  `;
  card.onclick = () => {
    betGift = g;
    // If target is now cheaper or equal, clear it
    if (targetGift && targetGift.price <= betGift.price) {
      targetGift = null;
      renderTargetDisplay();
    }
    renderBetDisplay();
    updateChance();
    updateUpgradeBtn();
    closeModal('betModal');
  };
  return card;
}

function openTargetModal() {
  if (isSpinning) return;
  renderTargetGifts('');
  openModal('targetModal');
  document.getElementById('targetSearch').value = '';
}

function renderTargetGifts(query) {
  const body = document.getElementById('targetModalBody');
  body.innerHTML = '';

  const q = query.toLowerCase();
  const gifts = allGifts.filter(g => {
    if (q && !g.name.toLowerCase().includes(q)) return false;
    if (betGift && g.price <= betGift.price) return false; // must be more expensive
    return true;
  });

  if (gifts.length === 0) {
    body.innerHTML = `<div class="empty-state"><div class="empty-icon">🔍</div><p>No gifts found</p></div>`;
    return;
  }

  const grid = document.createElement('div');
  grid.className = 'gift-grid';
  for (const g of gifts) {
    grid.appendChild(makeTargetCard(g));
  }
  body.appendChild(grid);
}

function filterTargetGifts() {
  renderTargetGifts(document.getElementById('targetSearch').value);
}

function makeTargetCard(g) {
  const card = document.createElement('div');
  card.className = 'gift-card' + (targetGift?.name === g.name ? ' selected' : '');
  card.innerHTML = `
    ${imgWithFallback(encodeImageName(g.image), g.name)}
    <span class="card-name">${g.name}</span>
    <span class="card-price">⭐ ${g.price.toLocaleString()}</span>
  `;
  card.onclick = () => {
    targetGift = g;
    renderTargetDisplay();
    updateChance();
    updateUpgradeBtn();
    closeModal('targetModal');
  };
  return card;
}

function openInventoryModal() {
  const body = document.getElementById('invModalBody');
  body.innerHTML = '';

  if (myInventory.length === 0) {
    body.innerHTML = `<div class="empty-state"><div class="empty-icon">🎁</div><p>No gifts in inventory</p></div>`;
  } else {
    const grid = document.createElement('div');
    grid.className = 'gift-grid';
    for (const g of myInventory) {
      const card = document.createElement('div');
      card.className = 'gift-card';
      card.style.cursor = 'default';
      card.innerHTML = `
        ${imgWithFallback(encodeImageName(g.image), g.name)}
        <span class="card-name">${g.name}</span>
        <span class="card-price">⭐ ${g.price?.toLocaleString?.() || g.price}</span>
      `;
      grid.appendChild(card);
    }
    body.appendChild(grid);
  }

  openModal('invModal');
}

function openModal(id) {
  document.getElementById(id).classList.add('open');
}

function closeModal(id) {
  document.getElementById(id).classList.remove('open');
}

// ─── Confetti ─────────────────────────────────────────────────────────────────

function spawnConfetti() {
  const container = document.getElementById('confetti-container');
  const colors = ['#7c3aed','#a855f7','#22c55e','#f59e0b','#ec4899','#3b82f6'];
  for (let i = 0; i < 60; i++) {
    setTimeout(() => {
      const piece = document.createElement('div');
      piece.className = 'confetti-piece';
      piece.style.left = Math.random() * 100 + 'vw';
      piece.style.background = colors[Math.floor(Math.random() * colors.length)];
      piece.style.animationDuration = (1.5 + Math.random() * 2) + 's';
      piece.style.animationDelay = (Math.random() * 0.5) + 's';
      piece.style.width = (6 + Math.random() * 8) + 'px';
      piece.style.height = (6 + Math.random() * 8) + 'px';
      container.appendChild(piece);
      setTimeout(() => piece.remove(), 4000);
    }, i * 30);
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ─── Event Bindings ───────────────────────────────────────────────────────────

document.getElementById('invBtn').addEventListener('click', openInventoryModal);

// Close modals on backdrop click
['invModal','betModal','targetModal'].forEach(id => {
  document.getElementById(id).addEventListener('click', function(e) {
    if (e.target === this) closeModal(id);
  });
});

// ─── Start ────────────────────────────────────────────────────────────────────

init();
