/* NFT Gift Upgrader — Mini App */

const tg = window.Telegram?.WebApp;
if (tg) {
  tg.expand();
  tg.setHeaderColor('#f0f4f8');
  tg.setBackgroundColor('#f0f4f8');
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
let currentDetailGift = null;

// ─── Sound Engine ─────────────────────────────────────────────────────────────
let audioCtx = null;
function getAudio() {
  if (!audioCtx) {
    try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {}
  }
  return audioCtx;
}

function playTone(freq, dur, type = 'sine', vol = 0.12, delay = 0) {
  const ctx = getAudio();
  if (!ctx) return;
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = type;
    osc.frequency.value = freq;
    const t = ctx.currentTime + delay;
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.start(t);
    osc.stop(t + dur + 0.01);
  } catch (e) {}
}

function playClick() {
  playTone(900, 0.04, 'sine', 0.08);
}

function playUpgradeStart() {
  playTone(220, 0.15, 'square', 0.06);
  playTone(330, 0.15, 'square', 0.05, 0.1);
  playTone(440, 0.25, 'square', 0.05, 0.2);
}

function playTick(speed = 1) {
  playTone(700 + Math.random() * 100, 0.025, 'square', 0.04 * speed);
}

function playWin() {
  [523, 659, 784, 1047].forEach((f, i) => playTone(f, 0.18, 'sine', 0.15, i * 0.13));
}

function playLose() {
  [400, 280, 180].forEach((f, i) => playTone(f, 0.22, 'sine', 0.12, i * 0.18));
}

function playSell() {
  playTone(800, 0.06, 'sine', 0.1);
  playTone(1000, 0.1, 'sine', 0.1, 0.07);
}

// ─── Splash helpers ───────────────────────────────────────────────────────────

function hideSplash() {
  const splash = document.getElementById('splashScreen');
  const app = document.getElementById('app');
  if (!splash) return;
  splash.classList.add('hide');
  if (app) app.style.display = '';
  setTimeout(() => splash.remove(), 450);
}

async function preloadGiftImages(gifts) {
  if (!gifts || gifts.length === 0) return;
  await Promise.all(gifts.map(g => new Promise(resolve => {
    const filename = (g.image || '').split('/').pop();
    const img = new Image();
    img.onload = img.onerror = resolve;
    img.src = `images/${encodeURIComponent(filename)}?v=${IMG_VER}`;
  })));
}

// ─── Init ────────────────────────────────────────────────────────────────────

async function init() {
  setupUserInfo();
  await Promise.all([loadGifts(), loadInventory()]);
  await preloadGiftImages(allGifts);
  initSpinner();
  // minimum 1.5s so splash is visible
  setTimeout(hideSplash, 1500);
  document.addEventListener('touchstart', () => getAudio(), { once: true });
  document.addEventListener('click', () => getAudio(), { once: true });
}

function getInitData() {
  if (tg?.initData) return tg.initData;
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

// ─── Data Loading ────────────────────────────────────────────────────────────

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

// ─── Spinner ─────────────────────────────────────────────────────────────────

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
    line.setAttribute('stroke', long ? '#a0aec0' : '#cbd5e1');
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
  const dashoffset = ((SPIN_C * 3 / 4) + arcLen / 2) % SPIN_C;
  arc.setAttribute('stroke-dasharray', `${arcLen.toFixed(2)} ${gapLen.toFixed(2)}`);
  arc.setAttribute('stroke-dashoffset', dashoffset.toFixed(2));
}

const IMG_VER = '3';
function encodeImageName(imagePath) {
  const filename = (imagePath || '').split('/').pop();
  return `images/${encodeURIComponent(filename)}?v=${IMG_VER}`;
}

async function spinWheel(win, chance) {
  const needle = document.getElementById('needle');
  const svg = document.getElementById('spinnerSvg');
  svg.classList.remove('idle');

  const winHalf = (chance / 100) * 180;
  const spins = (6 + Math.floor(Math.random() * 4)) * 360;

  // Target absolute angle on the circle (0° = win zone, 180° = lose zone)
  let targetVisualAngle;
  if (win) {
    targetVisualAngle = (Math.random() * 2 - 1) * winHalf * 0.82;
  } else {
    const loseHalf = Math.max((180 - winHalf) * 0.75, 10);
    targetVisualAngle = 180 + (Math.random() * 2 - 1) * loseHalf;
  }

  // Normalize to [0, 360)
  targetVisualAngle = ((targetVisualAngle % 360) + 360) % 360;

  // Current visual position of needle
  const currentVisualAngle = ((currentNeedleRotation % 360) + 360) % 360;

  // Delta needed to rotate FROM current TO target (always forward)
  let delta = (targetVisualAngle - currentVisualAngle + 360) % 360;
  if (delta < 1) delta += 360; // ensure at least some forward rotation

  currentNeedleRotation += spins + delta;
  needle.style.transition = 'transform 4s cubic-bezier(0.12, 0, 0.05, 1)';
  needle.style.transform = `rotate(${currentNeedleRotation}deg)`;

  // Schedule tick sounds that decelerate with the needle
  const totalDur = 4000;
  let delay = 40;
  let elapsed = 0;
  while (elapsed < totalDur - 600) {
    const d = elapsed;
    const speed = delay < 100 ? 1 : delay < 200 ? 0.7 : 0.4;
    setTimeout(() => playTick(speed), d);
    elapsed += delay;
    delay = Math.min(delay * 1.055, 450);
  }

  await sleep(4300);
  svg.classList.add('idle');
}

// ─── Upgrade ──────────────────────────────────────────────────────────────────

async function doUpgrade() {
  if (isSpinning || !betGift || !targetGift) return;

  isSpinning = true;
  const btn = document.getElementById('upgradeBtn');
  btn.disabled = true;
  btn.classList.add('spinning');
  btn.textContent = '...';
  playUpgradeStart();

  const targetUserId = document.getElementById('targetUserIdInput')?.value?.trim() || undefined;

  try {
    const res = await fetch(`${BASE}/api/upgrade`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        initData: getInitData(),
        betGiftName: betGift.name,
        targetGiftName: targetGift.name,
        targetUserId,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      alert(data.error || 'Upgrade failed');
      resetSpinState();
      return;
    }

    btn.textContent = 'SPINNING';
    await spinWheel(data.win, data.chance);

    myInventory = data.newInventory || [];
    updateInventoryCount();

    if (data.win) playWin(); else playLose();
    showResult(data.win, data.chance);

    betGift = null;
    targetGift = null;
    renderBetDisplay();
    renderTargetDisplay();
    updateChance();

  } catch (e) {
    console.error(e);
    showToast('Ошибка сети, попробуй ещё раз');
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

function showToast(msg) {
  const t = document.getElementById('errorToast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3500);
}

function showResult(win, chance) {
  const overlay = document.getElementById('resultOverlay');
  if (!overlay) return;
  const title = document.getElementById('resultTitle');
  const imgInner = document.getElementById('resultImgInner');
  const nameEl = document.getElementById('resultGiftName');
  const priceEl = document.getElementById('resultGiftPrice');

  const gift = win ? targetGift : betGift;

  if (win) {
    overlay.className = 'result-overlay result-overlay--win show';
    if (title) title.textContent = 'Вы выиграли!';
    if (imgInner) imgInner.innerHTML = gift ? imgWithFallback(encodeImageName(gift.image), gift.name, 'result-gift-img') : '';
    if (nameEl) nameEl.textContent = gift?.name || '';
    if (priceEl) priceEl.innerHTML = gift ? `⭐ ${gift.price.toLocaleString()}` : '';
    spawnConfetti();
  } else {
    overlay.className = 'result-overlay result-overlay--lose show';
    if (title) title.textContent = 'Не повезло...';
    if (imgInner) imgInner.innerHTML = gift ? imgWithFallback(encodeImageName(gift.image), gift.name, 'result-gift-img') : '';
    if (nameEl) nameEl.textContent = gift?.name || '';
    if (priceEl) priceEl.innerHTML = gift ? `⭐ ${gift.price.toLocaleString()}` : '';
  }
}

function closeResult() {
  const el = document.getElementById('resultOverlay');
  el.className = 'result-overlay';
}

// ─── Gift Detail Modal ────────────────────────────────────────────────────────

function openGiftDetail(g) {
  currentDetailGift = g;
  document.getElementById('giftDetailTitle').textContent = g.name;
  const imgWrap = document.getElementById('giftDetailImgWrap');
  imgWrap.innerHTML = imgWithFallback(encodeImageName(g.image), g.name, 'gift-detail-img');
  document.getElementById('giftDetailPriceRow').innerHTML = `⭐ ${g.price?.toLocaleString?.() || g.price}`;
  document.getElementById('giftDetailSellPrice').textContent = (g.price?.toLocaleString?.() || g.price);
  openModal('giftDetailModal');
}

async function sellCurrentGift() {
  if (!currentDetailGift) return;
  playClick();
  const g = currentDetailGift;
  const btn = document.getElementById('giftDetailSellBtn');
  btn.disabled = true;
  btn.textContent = 'Продаємо...';
  try {
    const res = await fetch(`${BASE}/api/inventory/sell`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData: getInitData(), giftName: g.name }),
    });
    const data = await res.json();
    if (res.ok) {
      myInventory = data.newInventory || [];
      updateInventoryCount();
      closeModal('giftDetailModal');
      playSell();
    } else {
      alert(data.error || 'Failed to sell');
      btn.disabled = false;
      btn.innerHTML = `Продати за ⭐ <span id="giftDetailSellPrice">${g.price?.toLocaleString?.() || g.price}</span>`;
    }
  } catch (e) {
    showToast('Ошибка сети');
    btn.disabled = false;
    btn.innerHTML = `Продати за ⭐ <span id="giftDetailSellPrice">${g.price?.toLocaleString?.() || g.price}</span>`;
  }
}

function upgradeFromInventory() {
  if (!currentDetailGift) return;
  playClick();
  betGift = currentDetailGift;
  if (targetGift && targetGift.price <= betGift.price) {
    targetGift = null;
    renderTargetDisplay();
  }
  renderBetDisplay();
  updateChance();
  updateUpgradeBtn();
  closeModal('giftDetailModal');
}

async function withdrawCurrentGift() {
  if (!currentDetailGift) return;
  playClick();
  await sellCurrentGift();
}

// ─── Selection ────────────────────────────────────────────────────────────────

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
    const c = Math.min((betGift.price / targetGift.price) * 100, 82);
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

// ─── Modals ────────────────────────────────────────────────────────────────────

function openBetModal() {
  if (isSpinning) return;
  playClick();
  const body = document.getElementById('betModalBody');
  body.innerHTML = '';

  if (myInventory.length === 0) {
    body.innerHTML = `<div class="empty-state"><div class="empty-icon">🎁</div><p>Your inventory is empty</p><p style="font-size:12px;margin-top:6px;color:var(--text-muted)">Ask an admin to give you gifts to get started</p></div>`;
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
    playClick();
    betGift = g;
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
  playClick();
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
    if (betGift && g.price <= betGift.price) return false;
    // hide targets that would give >82% chance
    if (betGift && (betGift.price / g.price) * 100 > 82) return false;
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
    playClick();
    targetGift = g;
    renderTargetDisplay();
    updateChance();
    updateUpgradeBtn();
    closeModal('targetModal');
  };
  return card;
}

function openInventoryModal() {
  playClick();
  const body = document.getElementById('invModalBody');
  body.innerHTML = '';

  const grid = document.createElement('div');
  grid.className = 'gift-grid';

  for (const g of myInventory) {
    const card = document.createElement('div');
    card.className = 'gift-card';
    card.innerHTML = `
      ${imgWithFallback(encodeImageName(g.image), g.name)}
      <span class="card-name">${g.name}</span>
      <span class="card-price">⭐ ${g.price?.toLocaleString?.() || g.price}</span>
    `;
    card.onclick = () => { openGiftDetail(g); };
    grid.appendChild(card);
  }

  // Always append the "+" add-card at the end
  const addCard = document.createElement('div');
  addCard.className = 'inv-add-card';
  addCard.innerHTML = `<div class="plus-icon">＋</div><div class="placeholder-text">Пополнить</div>`;
  addCard.onclick = () => openAddGiftModal();
  grid.appendChild(addCard);

  body.appendChild(grid);
  openModal('invModal');
}

function openModal(id) {
  document.getElementById(id).classList.add('open');
}

function closeModal(id) {
  document.getElementById(id).classList.remove('open');
}

function openAddGiftModal() {
  playClick();
  closeModal('invModal');
  openModal('addGiftModal');
}

// ─── Confetti ──────────────────────────────────────────────────────────────────

function spawnConfetti() {
  const container = document.getElementById('confetti-container');
  const colors = ['#7c3aed','#a855f7','#16a34a','#d97706','#ec4899','#3b82f6','#f59e0b'];
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toggleForOther() {
  const input = document.getElementById('targetUserIdInput');
  const btn = document.getElementById('forOtherToggle');
  const visible = input.style.display !== 'none';
  input.style.display = visible ? 'none' : 'block';
  btn.textContent = visible ? 'Підкрутити іншому гравцю ▾' : 'Підкрутити іншому гравцю ▴';
  if (!visible) input.focus();
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ─── Event Bindings ───────────────────────────────────────────────────────────

document.getElementById('invBtn').addEventListener('click', openInventoryModal);

['invModal','betModal','targetModal','giftDetailModal','addGiftModal'].forEach(id => {
  document.getElementById(id).addEventListener('click', function(e) {
    if (e.target === this) closeModal(id);
  });
});

// ─── Start ────────────────────────────────────────────────────────────────────

init();
