// ä¸´æåç¥ â ä¸»åºç¨é»è¾
(function() {
  'use strict';

  // ===== ç¶æ =====
  let currentFilter = 'å¨é¨';
  let editingId = null;

  const CATEGORIES = ['å¨é¨', 'å·è', 'å·å»', 'å¸¸æ¸©', 'å¹²è´§', 'æ°´æ', 'è¬è', 'å¶ä»'];

  const CATEGORY_ICONS = {
    'å·è': 'ð§',
    'å·å»': 'âï¸',
    'å¸¸æ¸©': 'ð ',
    'å¹²è´§': 'ð¾',
    'æ°´æ': 'ð',
    'è¬è': 'ð¥¬',
    'å¶ä»': 'ð¦'
  };

  // ===== DOM å¼ç¨ =====
  const $ = (id) => document.getElementById(id);
  const els = {
    list: $('food-list'),
    empty: $('empty-state'),
    stats: {
      total: $('stat-total'),
      warn: $('stat-warn'),
      expired: $('stat-expired'),
      saved: $('stat-saved'),
      savedCard: $('stat-saved-card')
    },
    tabs: $('category-tabs'),
    addBtn: $('add-btn'),
    settingsBtn: $('settings-btn'),
    modal: $('add-modal'),
    scanModal: $('scan-modal'),
    settingsModal: $('settings-modal'),
    proModal: $('pro-modal'),
    form: $('add-form'),
    modalTitle: $('modal-title'),
    toast: $('toast')
  };

  // ===== å·¥å· =====
  function daysUntil(dateStr) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(dateStr);
    target.setHours(0, 0, 0, 0);
    return Math.floor((target - today) / (24 * 60 * 60 * 1000));
  }

  function statusOf(days) {
    if (days <= 0) return 'danger';
    if (days <= 3) return 'warn';
    return 'safe';
  }

  function showToast(msg, duration = 2000) {
    els.toast.textContent = msg;
    els.toast.classList.add('show');
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => els.toast.classList.remove('show'), duration);
  }

  function formatDate(d) {
    const date = new Date(d);
    return `${date.getMonth() + 1}æ${date.getDate()}æ¥`;
  }

  // ===== æ¸²æ =====
  async function render() {
    const all = await LQDB.getActiveFoods();
    all.sort((a, b) => daysUntil(a.expiry) - daysUntil(b.expiry));

    const filtered = currentFilter === 'å¨é¨'
      ? all
      : all.filter(f => f.category === currentFilter);

    renderTabs(all);
    renderList(filtered);
    renderStats(all);
  }

  function renderTabs(all) {
    const counts = { 'å¨é¨': all.length };
    for (const f of all) {
      counts[f.category] = (counts[f.category] || 0) + 1;
    }
    els.tabs.innerHTML = CATEGORIES.map(cat => `
      <button class="cat-tab ${cat === currentFilter ? 'active' : ''}" data-cat="${cat}">
        ${cat} <span class="count">${counts[cat] || 0}</span>
      </button>
    `).join('');
    els.tabs.querySelectorAll('.cat-tab').forEach(btn => {
      btn.onclick = () => {
        currentFilter = btn.dataset.cat;
        render();
      };
    });
  }

  function renderList(items) {
    if (items.length === 0) {
      els.list.innerHTML = '';
      els.empty.style.display = 'block';
      return;
    }
    els.empty.style.display = 'none';
    els.list.innerHTML = items.map(item => {
      const days = daysUntil(item.expiry);
      const status = statusOf(days);
      const icon = CATEGORY_ICONS[item.category] || 'ð¦';
      const expiryText = days < 0
        ? `å·²è¿æ ${-days} å¤©`
        : days === 0
          ? 'ä»å¤©å°æ'
          : days === 1
            ? 'æå¤©å°æ'
            : `${days} å¤©å`;
      return `
        <li class="food-item ${status}" data-id="${item.id}">
          <div class="icon">${icon}</div>
          <div class="food-info">
            <div class="food-name">
              ${escapeHtml(item.name)}
              ${item.qty > 1 ? '<span class="qty">Ã' + item.qty + escapeHtml(item.unit || '') + '</span>' : ''}
            </div>
            <div class="food-meta">
              <span class="category">${escapeHtml(item.category)}</span>
              <span class="expiry">ð ${formatDate(item.expiry)} Â· ${expiryText}</span>
            </div>
          </div>
          <div class="food-actions">
            <button class="consume" data-act="consume" title="æ è®°å·²æ¶è">â</button>
            <button data-act="edit" title="ç¼è¾">â</button>
          </div>
        </li>
      `;
    }).join('');

    els.list.querySelectorAll('.food-item').forEach(li => {
      const id = li.dataset.id;
      li.querySelector('[data-act="consume"]').onclick = (e) => {
        e.stopPropagation();
        consumeItem(id);
      };
      li.querySelector('[data-act="edit"]').onclick = (e) => {
        e.stopPropagation();
        editItem(id);
      };
    });
  }

  async function renderStats(all) {
    let warn = 0, expired = 0;
    for (const f of all) {
      const d = daysUntil(f.expiry);
      if (d <= 0) expired++;
      else if (d <= 3) warn++;
    }
    els.stats.total.textContent = all.length;
    els.stats.warn.textContent = warn;
    els.stats.expired.textContent = expired;

    const pro = await LQPro.isPro();
    if (pro) {
      const history = await LQDB.getHistory(1000);
      const avgPrice = await LQDB.getSetting('avgPrice', 15);
      const saved = history.length * avgPrice;
      els.stats.saved.textContent = 'Â¥' + saved.toLocaleString();
      els.stats.savedCard.style.display = 'block';
    } else {
      els.stats.savedCard.style.display = 'none';
    }
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[c]);
  }

  // ===== æä½ =====
  async function consumeItem(id) {
    await LQDB.consumeFood(id);
    showToast('â å·²æ è®°æ¶è');
    render();
  }

  async function editItem(id) {
    const item = await LQDB.getFood(id);
    if (!item) return;
    editingId = id;
    els.modalTitle.textContent = 'ç¼è¾é£å';
    $('f-name').value = item.name;
    $('f-category').value = item.category;
    $('f-expiry').value = item.expiry;
    $('f-qty').value = item.qty;
    $('f-unit').value = item.unit || 'ä¸ª';
    $('f-note').value = item.note || '';
    openModal(els.modal);
  }

  function openAddModal() {
    editingId = null;
    els.modalTitle.textContent = 'æ·»å é£å';
    els.form.reset();
    $('f-qty').value = 1;
    $('f-unit').value = 'ä¸ª';
    const d = new Date();
    d.setDate(d.getDate() + 7);
    $('f-expiry').value = d.toISOString().slice(0, 10);
    openModal(els.modal);
  }

  function openModal(modal) {
    modal.classList.add('open');
  }

  function closeModal(modal) {
    modal.classList.remove('open');
  }

  // ===== äºä»¶ç»å® =====
  function bindEvents() {
    els.addBtn.onclick = openAddModal;

    els.settingsBtn.onclick = async () => {
      await refreshSettingsUI();
      openModal(els.settingsModal);
    };

    document.querySelectorAll('.close-btn, .modal-backdrop').forEach(el => {
      el.onclick = (e) => {
        const modal = e.target.closest('.modal');
        if (modal) closeModal(modal);
        if (modal === els.scanModal) LQBarcode.stop();
      };
    });

    els.form.onsubmit = async (e) => {
      e.preventDefault();
      const data = {
        name: $('f-name').value.trim(),
        category: $('f-category').value,
        expiry: $('f-expiry').value,
        qty: parseInt($('f-qty').value) || 1,
        unit: $('f-unit').value.trim() || 'ä¸ª',
        note: $('f-note').value.trim()
      };
      if (!data.name || !data.expiry) {
        showToast('è¯·å¡«ååç§°åä¿è´¨æ');
        return;
      }
      if (!editingId) {
        const limit = await LQPro.checkLimit();
        if (!limit.ok) {
          showToast('åè´¹çå·²è¾¾ä¸éï¼' + limit.limit + ' æ¡ï¼ï¼åçº§ Pro è§£é');
          closeModal(els.modal);
          openModal(els.proModal);
          return;
        }
      }
      try {
        if (editingId) {
          await LQDB.updateFood(editingId, data);
          showToast('â å·²æ´æ°');
        } else {
          await LQDB.addFood(data);
          showToast('â å·²æ·»å ');
        }
        closeModal(els.modal);
        render();
        triggerExpiryCheck();
      } catch (err) {
        showToast('ä¿å­å¤±è´¥ï¼' + err.message);
      }
    };

    $('scan-btn').onclick = openScanModal;
    $('scan-skip').onclick = () => {
      LQBarcode.stop();
      closeModal(els.scanModal);
    };

    $('set-warn-days').onchange = async (e) => {
      await LQDB.setSetting('warnDays', parseInt(e.target.value));
      showToast('â å·²ä¿å­');
    };
    $('set-avg-price').onchange = async (e) => {
      await LQDB.setSetting('avgPrice', parseInt(e.target.value) || 15);
      render();
      showToast('â å·²ä¿å­');
    };
    $('export-btn').onclick = exportData;
    $('import-btn').onclick = () => $('import-file').click();
    $('import-file').onchange = importData;
    $('notify-btn').onclick = enableNotifications;
    $('clear-btn').onclick = clearAllData;
    $('pro-link').onclick = async () => {
      const pro = await LQPro.isPro();
      if (pro) {
        showToast('æ¨å·²æ¯ Pro ç¨æ·');
        return;
      }
      openModal(els.proModal);
    };
    $('unlock-btn').onclick = handleUnlock;
  }

  async function refreshSettingsUI() {
    $('set-warn-days').value = await LQDB.getSetting('warnDays', 3);
    $('set-avg-price').value = await LQDB.getSetting('avgPrice', 15);
    const pro = await LQPro.isPro();
    $('pro-status').textContent = pro
      ? 'â Pro ç¨æ· Â· å¨é¨åè½å·²è§£é'
      : 'åè´¹ç Â· 50 æ¡ä¸é';
    const notifyStatus = LQNotify.getPermissionStatus();
    const statusMap = {
      'granted': 'â å·²å¼å¯',
      'denied': 'â å·²æç»',
      'default': 'æªå¼å¯ï¼ç¹å»å¼å¯',
      'unsupported': 'æµè§å¨ä¸æ¯æ'
    };
    $('notify-status').textContent = statusMap[notifyStatus] || 'æªç¥';
  }

  // ===== æ«ç  =====
  async function openScanModal() {
    if (!LQBarcode.isSupported()) {
      showToast('å½åæµè§å¨ä¸æ¯ææ¡ç æ«æï¼è¯·æå¨è¾å¥');
      return;
    }
    closeModal(els.modal);
    openModal(els.scanModal);
    try {
      await LQBarcode.start($('scan-video'), handleBarcodeDetected);
    } catch (err) {
      showToast(err.message);
      closeModal(els.scanModal);
    }
  }

  async function handleBarcodeDetected(code) {
    closeModal(els.scanModal);
    const product = await LQBarcode.lookupBarcode(code);
    if (product) {
      $('f-name').value = product.name;
      $('f-category').value = product.category;
      showToast('â å·²è¯å«ï¼' + product.name);
    } else {
      showToast('æ¡ç ï¼' + code + 'ï¼æªè¯å«ï¼è¯·æå¨å¡«ååç§°ï¼');
    }
    editingId = null;
    els.modalTitle.textContent = 'æ·»å é£å';
    openModal(els.modal);
  }

  // ===== éç¥ =====
  async function enableNotifications() {
    const result = await LQNotify.requestPermission();
    if (result.ok) {
      showToast('â éç¥å·²å¼å¯');
      await refreshSettingsUI();
      triggerExpiryCheck();
    } else {
      showToast(result.reason || 'å¼å¯å¤±è´¥');
    }
  }

  async function triggerExpiryCheck() {
    const items = await LQDB.getActiveFoods();
    const warnDays = await LQDB.getSetting('warnDays', 3);
    await LQNotify.checkAndNotify(items, warnDays);
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'CHECK_EXPIRY',
        items,
        warnDays
      });
    }
  }

  // ===== å¯¼å¥å¯¼åº =====
  async function exportData() {
    try {
      const data = await LQDB.exportAll();
      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const ts = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = 'lq-xianzhi-backup-' + ts + '.json';
      a.click();
      URL.revokeObjectURL(url);
      showToast('â å·²å¯¼åº');
    } catch (err) {
      showToast('å¯¼åºå¤±è´¥ï¼' + err.message);
    }
  }

  async function importData(e) {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!confirm('å¯¼å¥å°è¦çç°ææ°æ®ï¼ç¡®å®ç»§ç»­ï¼')) {
        e.target.value = '';
        return;
      }
      await LQDB.importAll(data, false);
      showToast('â å·²å¯¼å¥ ' + data.foods.length + ' æ¡æ°æ®');
      render();
      e.target.value = '';
    } catch (err) {
      showToast('å¯¼å¥å¤±è´¥ï¼' + err.message);
      e.target.value = '';
    }
  }

  async function clearAllData() {
    if (!confirm('ç¡®è®¤æ¸ç©ºæææ°æ®ï¼æ­¤æä½ä¸å¯æ¢å¤ï¼')) return;
    if (!confirm('åæ¬¡ç¡®è®¤ï¼ææåºå­ååå²å°è¢«æ°¸ä¹å é¤')) return;
    await LQDB.clearAll();
    showToast('å·²æ¸ç©º');
    render();
  }

  // ===== Pro =====
  async function handleUnlock() {
    const code = $('unlock-code').value;
    const result = await LQPro.unlockWithCode(code);
    if (result.ok) {
      showToast('ð Pro è§£éæå');
      closeModal(els.proModal);
      await refreshSettingsUI();
      render();
    } else {
      showToast(result.msg);
    }
  }

  // ===== å¯å¨ =====
  async function init() {
    bindEvents();

    if ('serviceWorker' in navigator) {
      try {
        await navigator.serviceWorker.register('./sw.js');
      } catch (err) {
        console.warn('[SW] æ³¨åå¤±è´¥', err);
      }
    }

    LQNotify.startScheduledCheck(() => LQDB.getActiveFoods());

    await render();

    if (!$('f-expiry').value) {
      const d = new Date();
      d.setDate(d.getDate() + 7);
      $('f-expiry').value = d.toISOString().slice(0, 10);
    }

    if (location.hash === '#add') {
      openAddModal();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
