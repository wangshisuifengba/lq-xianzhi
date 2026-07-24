/* æ¶å­æ¹¡éå ¢ç¡ é¥?æ¶è¯²ç°²é¢ã©â¬æç·«éå æ£¤æ££æ §çå¯®å­ç¥éå ¬ç´ */

// ===== éã¥ç¬éèµâ¬?=====
let foods = [];
let currentFilter = 'éã©å´';
let warnDays = 3;
let editingId = null;

// ===== ç¯æåº =====
const CATEGORIES = ['éç¯æ£', 'éå³°å', 'ç¯åä¿¯', 'éªè¶æ£', 'å§å­ç', 'éîå½', 'éæµç²¬'];
const CATEGORY_ICONS = { 'éç¯æ£': 'é¦î', 'éå³°å': 'éå¶ç¬', 'ç¯åä¿¯': 'é¦å½', 'éªè¶æ£': 'é¦å°µ', 'å§å­ç': 'é¦å´', 'éîå½': 'é¦ã¬', 'éæµç²¬': 'é¦æ' };

// ===== DOM å¯®æ æ¤ =====
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// ===== éæ¿îé?=====
async function init() {
  await initDB();
  await loadSettings();
  await refreshList();

  // æµå¬©æ¬¢ç¼æç¾
  $('#add-btn').addEventListener('click', () => openAddModal());
  $('#settings-btn').addEventListener('click', () => openSettings());
  $('#add-form').addEventListener('submit', handleFormSubmit);
  $('#scan-btn').addEventListener('click', () => openScanModal());
  $('#scan-skip').addEventListener('click', () => closeModal('scan-modal'));
  $('#unlock-btn').addEventListener('click', handleUnlock);
  $('#clear-btn').addEventListener('click', handleClearData);
  $('#export-btn').addEventListener('click', handleExport);
  $('#import-btn').addEventListener('click', () => $('#import-file').click());
  $('#import-file').addEventListener('change', handleImport);
  $('#notify-btn').addEventListener('click', handleNotifyToggle);
  $('#pro-link').addEventListener('click', () => openModal('pro-modal'));
  $('#set-warn-days').addEventListener('change', handleWarnDaysChange);

  // å¦¯ââ¬ä½¹îéæ½æ£´
  $$('.modal-backdrop, .close-btn').forEach(el => {
    el.addEventListener('click', (e) => {
      const modal = el.closest('.modal');
      if (modal) closeModal(modal.id);
    });
  });

  // é§æî Service Worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
}

// ===== çå§çéçºæµ =====
async function loadSettings() {
  warnDays = parseInt(localStorage.getItem('lq-warn-days') || '3');
  $('#set-warn-days').value = warnDays;
  updateNotifyStatus();
}

function handleWarnDaysChange(e) {
  warnDays = parseInt(e.target.value);
  localStorage.setItem('lq-warn-days', warnDays);
  refreshList();
}

// ===== éæ¥ãééæ =====
async function refreshList() {
  foods = await getAllFoods();
  foods.sort((a, b) => new Date(a.expiry) - new Date(b.expiry));

  renderStats();
  renderCategories();
  renderList();

  // éæ¬ç²¯å¦«â¬éã©â¬æ°±ç¡éå ç¬å¯®å­ç¥é?  checkExpiryNotifications(foods, warnDays);
}

// ===== ç¼ç»î¸ =====
function renderStats() {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const warnDate = new Date(today); warnDate.setDate(warnDate.getDate() + warnDays);

  let total = foods.length;
  let warn = 0, expired = 0;

  foods.forEach(f => {
    const d = new Date(f.expiry); d.setHours(0, 0, 0, 0);
    if (d < today) expired++;
    else if (d <= warnDate) warn++;
  });

  $('#stat-total').textContent = total;
  $('#stat-warn').textContent = warn;
  $('#stat-expired').textContent = expired;

  // éºåæ¸·é²æ¦î
  if (isPro()) {
    const avgPrice = parseInt(localStorage.getItem('lq-avg-price') || '15');
    $('#stat-saved').textContent = 'æ¥¼' + (total * avgPrice);
    $('#stat-saved-card').style.display = '';
  } else {
    $('#stat-saved-card').style.display = 'none';
  }

  // Pro éèµâ¬?  const proStatus = isPro() ? 'ç¸?å®¸è¶Ðé¿?Pro' : `éå¶åé?è·¯ ${getRemainingSlots(total)} éï¿ îæ´ï¹å¢¿æµ£æª;
  $('#pro-status').textContent = proStatus;
}

// ===== éåè¢«éå©î· =====
function renderCategories() {
  const tabs = $('#category-tabs');
  const cats = ['éã©å´', ...CATEGORIES];
  tabs.innerHTML = cats.map(c =>
    `<button class="tab${c === currentFilter ? ' active' : ''}" data-cat="${c}">${c === 'éã©å´' ? 'é¦æµ ' + c : (CATEGORY_ICONS[c] || 'é¦æ') + ' ' + c}</button>`
  ).join('');

  tabs.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      currentFilter = tab.dataset.cat;
      renderCategories();
      renderList();
    });
  });
}

// ===== æ¤ç·æ§éæ¥ã =====
function renderList() {
  const filtered = currentFilter === 'éã©å´' ? foods : foods.filter(f => f.category === currentFilter);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const warnDate = new Date(today); warnDate.setDate(warnDate.getDate() + warnDays);

  const emptyState = $('#empty-state');
  const foodList = $('#food-list');

  if (filtered.length === 0) {
    emptyState.style.display = '';
    foodList.innerHTML = '';
    return;
  }

  emptyState.style.display = 'none';
  foodList.innerHTML = filtered.map(f => {
    const d = new Date(f.expiry); d.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((d - today) / 86400000);
    let statusClass = '';
    let statusText = '';
    if (diffDays < 0) { statusClass = 'danger'; statusText = 'å®¸è¶ç¹é?; }
    else if (diffDays <= warnDays) { statusClass = 'warn'; statusText = diffDays + 'æ¾¶âæéçæ¹¡'; }
    else { statusText = diffDays + 'æ¾¶âæéçæ¹¡'; }

    return `<li class="food-item ${statusClass}" data-id="${f.id}">
      <div class="food-info" onclick="openEditModal(${f.id})">
        <div class="food-name">${escapeHtml(f.name)} ${statusClass ? '<span style="font-size:0.7rem;color:' + (statusClass === 'danger' ? 'var(--danger)' : 'var(--warn)') + '">' + statusText + '</span>' : ''}</div>
        <div class="food-meta">${CATEGORY_ICONS[f.category] || ''} ${f.category} è·¯ ${f.qty || 1}${f.unit || 'æ¶?} è·¯ ${f.expiry}${f.note ? ' è·¯ ' + f.note : ''}</div>
      </div>
      <div class="food-actions">
        <button class="danger-btn" onclick="event.stopPropagation();handleDelete(${f.id})" title="éç»æ«">é¦æ£</button>
      </div>
    </li>`;
  }).join('');
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ===== å¨£è¯²å§ / ç¼æ ¬ç·« =====
function openAddModal() {
  editingId = null;
  $('#modal-title').textContent = 'å¨£è¯²å§æ¤ç·æ§';
  $('#add-form').reset();
  $('#f-expiry').value = new Date().toISOString().split('T')[0];
  $('#f-qty').value = '1';
  $('#f-unit').value = 'æ¶?;
  openModal('add-modal');
}

function openEditModal(id) {
  const food = foods.find(f => f.id === id);
  if (!food) return;
  editingId = id;
  $('#modal-title').textContent = 'ç¼æ ¬ç·«æ¤ç·æ§';
  $('#f-name').value = food.name;
  $('#f-category').value = food.category;
  $('#f-expiry').value = food.expiry;
  $('#f-qty').value = food.qty || 1;
  $('#f-unit').value = food.unit || 'æ¶?;
  $('#f-note').value = food.note || '';
  openModal('add-modal');
}

async function handleFormSubmit(e) {
  e.preventDefault();
  const name = $('#f-name').value.trim();
  if (!name) return showToast('çç¯ç·­éã©î¤éä½¸æç»?);

  const count = await getFoodCount();
  if (!isPro() && !editingId && count >= FREE_LIMIT) {
    showToast(`éå¶åéå æ¸¶æ¾¶?${FREE_LIMIT} éâç´çå³°å´ç»¾?Pro`);
    openModal('pro-modal');
    return;
  }

  const food = {
    name,
    category: $('#f-category').value,
    expiry: $('#f-expiry').value,
    qty: parseInt($('#f-qty').value) || 1,
    unit: $('#f-unit').value.trim() || 'æ¶?,
    note: $('#f-note').value.trim()
  };

  try {
    if (editingId) {
      await updateFood(editingId, food);
      showToast('å®¸åæ´¿é?);
    } else {
      await addFood(food);
      showToast('å®¸ååé?);
    }
    closeModal('add-modal');
    await refreshList();
  } catch (err) {
    showToast('é¿å¶ç¶æ¾¶è¾«è§¦: ' + err.message);
  }
}

// ===== éç»æ« =====
async function handleDelete(id) {
  if (!confirm('çº­î¼ç¾éç»æ«æ©æ¬æ½¯çæ¿ç¶éæ¥ç´µ')) return;
  try {
    await deleteFood(id);
    showToast('å®¸æå¹é?);
    await refreshList();
  } catch (err) {
    showToast('éç»æ«æ¾¶è¾«è§¦');
  }
}

// ===== éµî¤ç =====
function openScanModal() {
  openModal('scan-modal');
  const video = $('#scan-video');
  $('#scan-tip').textContent = 'çåæ½¯é®ä½¸î®éåîé?;
  startBarcodeScan(video, (code) => {
    closeModal('scan-modal');
    openAddModal();
    $('#f-name').value = 'éåæ§ ' + code.slice(-6);
    showToast('å®¸è¶çéî£æ½¯é®? ' + code.slice(-6));
  }, (err) => {
    $('#scan-tip').textContent = err;
  });
}

// ===== çï½æ£ =====
function handleUnlock() {
  const code = $('#unlock-code').value.trim();
  if (!code) return showToast('çç¯ç·­éã¨Ðé¿ä½ºç');
  if (unlockPro(code)) {
    showToast('çï½æ£é´æ¬å§é?);
    closeModal('pro-modal');
    refreshList();
  } else {
    showToast('çï½æ£é®ä½¹æ£¤é?);
  }
}

// ===== çå§ç =====
function openSettings() {
  const avgPrice = localStorage.getItem('lq-avg-price') || '15';
  $('#set-avg-price').value = avgPrice;
  $('#set-warn-days').value = warnDays;
  updateNotifyStatus();
  openModal('settings-modal');

  // ç¼æç¾éªå²æ½æµ å³°â¬é´æ¨é?  $('#set-avg-price').onchange = function() {
    const v = parseInt(this.value) || 15;
    localStorage.setItem('lq-avg-price', Math.max(1, Math.min(999, v)));
  };
}

function handleClearData() {
  if (!confirm('çº­î¼ç¾çä½¹ç«»ç»çå¢éå¤æé¹î¼æ§éç¸îé¿å¶ç¶æ¶å¶å½²é­ã î²é?)) return;
  if (!confirm('éå¶î¼çº­î¿î»éæ°­å¢éå¤î¤éä½½îè¤°æç¢çî£æ¡æ¶å­å¹éãâ¬?)) return;
  clearAllFoods().then(() => {
    showToast('å®¸åç«»ç»?);
    closeModal('settings-modal');
    refreshList();
  });
}

function updateNotifyStatus() {
  $('#notify-status').textContent = isNotificationEnabled() ? 'å®¸æç´é? : 'éîç´é?;
}

async function handleNotifyToggle() {
  const result = await requestNotificationPermission();
  if (result === 'granted') showToast('é«æ°±ç¡å®¸æç´é?);
  else if (result === 'denied') showToast('é«æ°±ç¡éå®æªºçî£å«ç¼æ¿ç´çå³°æ¹ªå¨´å¿îé£ã¨îç¼î»èå¯®â¬é?);
  else showToast('è¤°æ³å¢ å¨´å¿îé£ã¤ç¬éîå¯é«æ°±ç¡');
  updateNotifyStatus();
}

// ===== çµçå­ / çµçå =====
function handleExport() {
  const data = JSON.stringify(foods, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `æ¶å­æ¹¡éå ¢ç¡_æ¾¶å¦å¤_${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('å®¸æî±é?);
}

function handleImport(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async () => {
    try {
      const data = JSON.parse(reader.result);
      if (!Array.isArray(data)) throw new Error('éçç´¡é¿æ¬î¤');
      for (const item of data) {
        await addFood({
          name: item.name || 'éîæ¡é?,
          category: item.category || 'éæµç²¬',
          expiry: item.expiry || '',
          qty: item.qty || 1,
          unit: item.unit || 'æ¶?,
          note: item.note || ''
        });
      }
      showToast(`å®¸æî±é?${data.length} éî¦);
      refreshList();
    } catch (err) {
      showToast('çµçåæ¾¶è¾«è§¦: éå¦æ¬¢éçç´¡æ¶å¶îçº­?);
    }
  };
  reader.readAsText(file);
  e.target.value = '';
}

// ===== å¦¯ââ¬ä½¹î =====
function openModal(id) {
  const modal = $('#' + id);
  if (!modal) return;
  modal.style.display = 'flex';
}

function closeModal(id) {
  const modal = $('#' + id);
  if (!modal) return;
  modal.style.display = 'none';
  if (id === 'scan-modal') stopBarcodeScan();
}

// ===== Toast =====
let toastTimer;
function showToast(msg) {
  const toast = $('#toast');
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2000);
}

// ===== éîå§© =====
document.addEventListener('DOMContentLoaded', init);
