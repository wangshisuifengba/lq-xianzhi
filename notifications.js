// 临期先知 — 过期提醒通知
(function() {
  'use strict';

  async function requestPermission() {
    if (!('Notification' in window)) {
      return { ok: false, reason: '浏览器不支持通知' };
    }
    if (Notification.permission === 'granted') return { ok: true };
    if (Notification.permission === 'denied') {
      return { ok: false, reason: '通知权限已被拒绝，请在浏览器设置中开启' };
    }
    const result = await Notification.requestPermission();
    return {
      ok: result === 'granted',
      reason: result === 'granted' ? null : '用户未授予权限'
    };
  }

  function getPermissionStatus() {
    if (!('Notification' in window)) return 'unsupported';
    return Notification.permission;
  }

  async function checkAndNotify(items, warnDays) {
    if (getPermissionStatus() !== 'granted') return [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const triggered = [];

    for (const item of items) {
      if (item.consumed) continue;
      const expiry = new Date(item.expiry);
      expiry.setHours(0, 0, 0, 0);
      const daysLeft = Math.floor((expiry - today) / (24 * 60 * 60 * 1000));

      if (daysLeft <= 0) {
        showNotification('已过期', `「${item.name}」已过期，请尽快处理`, item.id, 'expired');
        triggered.push({ item, type: 'expired', daysLeft });
      } else if (daysLeft <= warnDays) {
        showNotification('临期提醒', `「${item.name}」还剩 ${daysLeft} 天过期`, item.id, 'warn');
        triggered.push({ item, type: 'warn', daysLeft });
      }
    }
    return triggered;
  }

  function showNotification(title, body, id, tag) {
    if (getPermissionStatus() !== 'granted') return;
    const options = {
      body,
      icon: './assets/icons/icon-192.png',
      badge: './assets/icons/icon-192.png',
      tag: tag + '-' + id,
      requireInteraction: true
    };
    try {
      const n = new Notification(title, options);
      n.onclick = () => {
        window.focus();
        n.close();
        // 滚动到该食品
        const el = document.querySelector(`[data-id="${id}"]`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      };
      setTimeout(() => n.close(), 8000);
    } catch (e) {
      console.warn('[Notify]', e);
    }
  }

  // 注册 Service Worker 后通过 SW 推送（更可靠）
  async function sendToServiceWorker(items, warnDays) {
    if (!('serviceWorker' in navigator)) return;
    const reg = await navigator.serviceWorker.ready;
    if (reg && reg.active) {
      reg.active.postMessage({
        type: 'CHECK_EXPIRY',
        items,
        warnDays
      });
    }
  }

  // 注册定时检查（每天一次，进入 App 时也检查）
  let checkTimer = null;
  function startScheduledCheck(getItems) {
    stopScheduledCheck();
    // 立即检查一次
    queueMicrotask(async () => {
      const items = await getItems();
      const warnDays = await LQDB.getSetting('warnDays', 3);
      await checkAndNotify(items, warnDays);
    });
    // 每小时检查一次（防止后台过期）
    checkTimer = setInterval(async () => {
      const items = await getItems();
      const warnDays = await LQDB.getSetting('warnDays', 3);
      await checkAndNotify(items, warnDays);
    }, 60 * 60 * 1000);
  }

  function stopScheduledCheck() {
    if (checkTimer) clearInterval(checkTimer);
    checkTimer = null;
  }

  window.LQNotify = {
    requestPermission,
    getPermissionStatus,
    checkAndNotify,
    startScheduledCheck,
    stopScheduledCheck
  };
})();