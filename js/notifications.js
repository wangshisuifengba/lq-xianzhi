// ä¸´æåç¥ â è¿ææééç¥
(function() {
  'use strict';

  async function requestPermission() {
    if (!('Notification' in window)) {
      return { ok: false, reason: 'æµè§å¨ä¸æ¯æéç¥' };
    }
    if (Notification.permission === 'granted') return { ok: true };
    if (Notification.permission === 'denied') {
      return { ok: false, reason: 'éç¥æéå·²è¢«æç»ï¼è¯·å¨æµè§å¨è®¾ç½®ä¸­å¼å¯' };
    }
    const result = await Notification.requestPermission();
    return {
      ok: result === 'granted',
      reason: result === 'granted' ? null : 'ç¨æ·æªæäºæé'
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
        showNotification('å·²è¿æ', 'ã' + item.name + 'ãå·²è¿æï¼è¯·å°½å¿«å¤ç', item.id, 'expired');
        triggered.push({ item, type: 'expired', daysLeft });
      } else if (daysLeft <= warnDays) {
        showNotification('ä¸´ææé', 'ã' + item.name + 'ãè¿å© ' + daysLeft + ' å¤©è¿æ', item.id, 'warn');
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
        const el = document.querySelector('[data-id="' + id + '"]');
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      };
      setTimeout(() => n.close(), 8000);
    } catch (e) {
      console.warn('[Notify]', e);
    }
  }

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

  let checkTimer = null;
  function startScheduledCheck(getItems) {
    stopScheduledCheck();
    queueMicrotask(async () => {
      const items = await getItems();
      const warnDays = await LQDB.getSetting('warnDays', 3);
      await checkAndNotify(items, warnDays);
    });
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
