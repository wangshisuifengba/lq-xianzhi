// 临期先知 — 主应用逻辑
(function() {
  'use strict';

  // ===== 状态 =====
  let currentFilter = '全部';
  let editingId = null;

  const CATEGORIES = ['全部', '冷藏', '冷冻', '常温', '干货', '水果', '蔬菜', '其他'];

  const CATEGORY_ICONS = {
    '冷藏': '🧊',
    '冷冻': '❄️',
    '常温': '🏠',
    '干货': '🌾',
    '水果': '🍎',
    '蔬菜': '🥬',
    '其他': '📦'
  };

  // ===== DOM 引用 =====
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

  // ===== 工具 =====
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
    return `${date.getMonth() + 1}月${date.getDate()}日`;
  }

  // ===== 渲染 =====
  async function render() {
    const all = await LQDB.getActiveFoods();
    // 排序：过期天数升序（最急的在前）
    all.sort((a, b) => daysUntil(a.expiry) - daysUntil(b.expiry));

    // 筛选
    const filtered = currentFilter === '全部'
      ? all
      : all.filter(f => f.category === currentFilter);

    renderTabs(all);
    renderList(filtered);
    renderStats(all);
  }

  function renderTabs(all) {
    const counts = { '全部': all.length };
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
      const icon = CATEGORY_ICONS[item.category] || '📦';
      const expiryText = days < 0
        ? `已过期 ${-days} 天`
        : days === 0
          ? '今天到期'
          : days === 1
            ? '明天到期'
            : `${days} 天后`;
      return `
        <li class="food-item ${status}" data-id="${item.id}">
          <div class="icon">${icon}</div>
          <div class="food-info">
            <div class="food-name">
              ${escapeHtml(item.name)}
              ${item.qty > 1 ? `<span class="qty">×${item.qty}${escapeHtml(item.unit || '')}</span>` : ''}
            </div>
            <div class="food-meta">
              <span class="category">${escapeHtml(item.category)}</span>
              <span class="expiry">📅 ${formatDate(item.expiry)} · ${expiryText}</span>
            </div>
          </div>
          <div class="food-actions">
            <button class="consume" data-act="consume" title="标记已消耗">✓</button>
            <button data-act="edit" title="编辑">✎</button>
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

    // 已节省（仅 Pro 显示）
    const pro = await LQPro.isPro();
    if (pro) {
      const history = await LQDB.getHistory(1000);
      const avgPrice = await LQDB.getSetting('avgPrice', 15);
      const saved = history.length * avgPrice;
      els.stats.saved.textContent = '¥' + saved.toLocaleString();
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

  // ===== 操作 =====
  async function consumeItem(id) {
    await LQDB.consumeFood(id);
    showToast('✓ 已标记消耗');
    render();
  }

  async function editItem(id) {
    const item = await LQDB.getFood(id);
    if (!item) return;
    editingId = id;
    els.modalTitle.textContent = '编辑食品';
    $('f-name').value = item.name;
    $('f-category').value = item.category;
    $('f-expiry').value = item.expiry;
    $('f-qty').value = item.qty;
    $('f-unit').value = item.unit || '个';
    $('f-note').value = item.note || '';
    openModal(els.modal);
  }

  function openAddModal() {
    editingId = null;
    els.modalTitle.textContent = '添加食品';
    els.form.reset();
    $('f-qty').value = 1;
    $('f-unit').value = '个';
    // 默认保质期 7 天后
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

  // ===== 事件绑定 =====
  function bindEvents() {
    // FAB
    els.addBtn.onclick = openAddModal;

    // 设置按钮
    els.settingsBtn.onclick = async () => {
      await refreshSettingsUI();
      openModal(els.settingsModal);
    };

    // 关闭按钮
    document.querySelectorAll('.close-btn, .modal-backdrop').forEach(el => {
      el.onclick = (e) => {
        const modal = e.target.closest('.modal');
        if (modal) closeModal(modal);
        if (modal === els.scanModal) LQBarcode.stop();
      };
    });

    // 表单提交
    els.form.onsubmit = async (e) => {
      e.preventDefault();
      const data = {
        name: $('f-name').value.trim(),
        category: $('f-category').value,
        expiry: $('f-expiry').value,
        qty: parseInt($('f-qty').value) || 1,
        unit: $('f-unit').value.trim() || '个',
        note: $('f-note').value.trim()
      };
      if (!data.name || !data.expiry) {
        showToast('请填写名称和保质期');
        return;
      }
      // 检查免费版上限
      if (!editingId) {
        const limit = await LQPro.checkLimit();
        if (!limit.ok) {
          showToast(`免费版已达上限（${limit.limit} 条），升级 Pro 解锁`);
          closeModal(els.modal);
          openModal(els.proModal);
          return;
        }
      }
      try {
        if (editingId) {
          await LQDB.updateFood(editingId, data);
          showToast('✓ 已更新');
        } else {
          await LQDB.addFood(data);
          showToast('✓ 已添加');
        }
        closeModal(els.modal);
        render();
        // 检查通知
        triggerExpiryCheck();
      } catch (err) {
        showToast('保存失败：' + err.message);
      }
    };

    // 扫码按钮
    $('scan-btn').onclick = openScanModal;
    $('scan-skip').onclick = () => {
      LQBarcode.stop();
      closeModal(els.scanModal);
    };

    // 设置项
    $('set-warn-days').onchange = async (e) => {
      await LQDB.setSetting('warnDays', parseInt(e.target.value));
      showToast('✓ 已保存');
    };
    $('set-avg-price').onchange = async (e) => {
      await LQDB.setSetting('avgPrice', parseInt(e.target.value) || 15);
      render();
      showToast('✓ 已保存');
    };
    $('export-btn').onclick = exportData;
    $('import-btn').onclick = () => $('import-file').click();
    $('import-file').onchange = importData;
    $('notify-btn').onclick = enableNotifications;
    $('clear-btn').onclick = clearAllData;
    $('pro-link').onclick = async () => {
      const pro = await LQPro.isPro();
      if (pro) {
        showToast('您已是 Pro 用户');
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
      ? '✓ Pro 用户 · 全部功能已解锁'
      : '免费版 · 50 条上限';
    const notifyStatus = LQNotify.getPermissionStatus();
    const statusMap = {
      'granted': '✓ 已开启',
      'denied': '✗ 已拒绝',
      'default': '未开启，点击开启',
      'unsupported': '浏览器不支持'
    };
    $('notify-status').textContent = statusMap[notifyStatus] || '未知';
  }

  // ===== 扫码 =====
  async function openScanModal() {
    if (!LQBarcode.isSupported()) {
      showToast('当前浏览器不支持条码扫描，请手动输入');
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
      showToast('✓ 已识别：' + product.name);
    } else {
      showToast('条码：' + code + '（未识别，请手动填写名称）');
    }
    editingId = null;
    els.modalTitle.textContent = '添加食品';
    openModal(els.modal);
  }

  // ===== 通知 =====
  async function enableNotifications() {
    const result = await LQNotify.requestPermission();
    if (result.ok) {
      showToast('✓ 通知已开启');
      await refreshSettingsUI();
      triggerExpiryCheck();
    } else {
      showToast(result.reason || '开启失败');
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

  // ===== 导入导出 =====
  async function exportData() {
    try {
      const data = await LQDB.exportAll();
      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const ts = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `lq-xianzhi-backup-${ts}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('✓ 已导出');
    } catch (err) {
      showToast('导出失败：' + err.message);
    }
  }

  async function importData(e) {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!confirm('导入将覆盖现有数据，确定继续？')) {
        e.target.value = '';
        return;
      }
      await LQDB.importAll(data, false);
      showToast('✓ 已导入 ' + data.foods.length + ' 条数据');
      render();
      e.target.value = '';
    } catch (err) {
      showToast('导入失败：' + err.message);
      e.target.value = '';
    }
  }

  async function clearAllData() {
    if (!confirm('确认清空所有数据？此操作不可恢复！')) return;
    if (!confirm('再次确认：所有库存和历史将被永久删除')) return;
    await LQDB.clearAll();
    showToast('已清空');
    render();
  }

  // ===== Pro =====
  async function handleUnlock() {
    const code = $('unlock-code').value;
    const result = await LQPro.unlockWithCode(code);
    if (result.ok) {
      showToast('🎉 Pro 解锁成功');
      closeModal(els.proModal);
      await refreshSettingsUI();
      render();
    } else {
      showToast(result.msg);
    }
  }

  // ===== 启动 =====
  async function init() {
    bindEvents();

    // 注册 Service Worker
    if ('serviceWorker' in navigator) {
      try {
        await navigator.serviceWorker.register('./sw.js');
      } catch (err) {
        console.warn('[SW] 注册失败', err);
      }
    }

    // 启动定时过期检查
    LQNotify.startScheduledCheck(() => LQDB.getActiveFoods());

    // 首次渲染
    await render();

    // 默认保质期设置
    if (!$('f-expiry').value) {
      const d = new Date();
      d.setDate(d.getDate() + 7);
      $('f-expiry').value = d.toISOString().slice(0, 10);
    }

    // URL #add 直接打开添加
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