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

// ─── Init ───────────────────────────────────────────────────────────────────

async function init() {
  setupUserInfo();
  await Promise.all([loadGifts(), loadInventory()]);
  buildIdleRoulette();
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

// ─── Roulette ───────────────────────────────────────────────────────────────

function buildIdleRoulette() {
  const items = document.getElementById('rouletteItems');
  items.innerHTML = '';

  // Show a shuffled sample of all gifts as decoration
  const pool = [...allGifts].sort(() => Math.random() - 0.5).slice(0, 20);
  for (const g of pool) {
    items.appendChild(makeRouletteItem(g));
  }

  items.style.transition = 'none';
  items.style.transform = 'translateX(0)';
}

function makeRouletteItem(gift, extraClass = '') {
  const div = document.createElement('div');
  div.className = 'roulette-item' + (extraClass ? ' ' + extraClass : '');
  div.innerHTML = `
    ${imgWithFallback(encodeImageName(gift.image), gift.name)}
    <span class="item-name">${gift.name}</span>
  `;
  return div;
}

function encodeImageName(imagePath) {
  const filename = imagePath.split('/').pop();
  // Use relative path so proxy prefix is preserved (resolves to /api/images/...)
  return `images/${filename}`;
}

async function spinRoulette(win) {
  const track = document.getElementById('rouletteTrack');
  const items = document.getElementById('rouletteItems');
  items.innerHTML = '';
  items.style.transition = 'none';
  items.style.transform = 'translateX(0)';

  const ITEM_WIDTH = 86; // 80px + 6px gap
  const VISIBLE = Math.ceil(track.offsetWidth / ITEM_WIDTH) + 2;
  const SPIN_COUNT = 40; // number of items to scroll through
  const CENTER_IDX = SPIN_COUNT + Math.floor(VISIBLE / 2);
  const TOTAL = SPIN_COUNT + VISIBLE + 10;

  // Build a pool: mostly random gifts, but result goes at CENTER_IDX
  const pool = [];
  for (let i = 0; i < TOTAL; i++) {
    const randGift = allGifts[Math.floor(Math.random() * allGifts.length)];
    pool.push(randGift);
  }

  // Place result at center
  const resultGift = win ? targetGift : betGift;
  pool[CENTER_IDX] = resultGift;

  for (const g of pool) {
    const cls = (g === resultGift && pool.indexOf(g) === CENTER_IDX) ? '' : '';
    items.appendChild(makeRouletteItem(g));
  }

  // Calculate the offset so CENTER_IDX is at the center of the track
  const trackCenter = track.offsetWidth / 2;
  const targetOffset = -(CENTER_IDX * ITEM_WIDTH - trackCenter + ITEM_WIDTH / 2);

  // Force reflow
  void items.offsetWidth;

  // Animate
  await new Promise(resolve => {
    items.style.transition = 'transform 4s cubic-bezier(0.12, 0, 0.05, 1)';
    items.style.transform = `translateX(${targetOffset}px)`;
    setTimeout(resolve, 4200);
  });

  // Highlight result
  const resultEl = items.children[CENTER_IDX];
  if (resultEl) {
    resultEl.classList.add(win ? 'win-item' : 'lose-item');
  }

  await sleep(300);
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

    // Spin animation
    await spinRoulette(data.win);

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
    buildIdleRoulette();
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
  } else {
    el.textContent = '—';
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
