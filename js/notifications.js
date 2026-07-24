/* æ¶å­æ¹¡éå ¢ç¡ é¥?é«æ°±ç¡é»æ°å */

const NOTIFY_KEY = 'lq-xianzhi-notify-enabled';

async function requestNotificationPermission() {
  if (!('Notification' in window)) {
    return 'unsupported';
  }
  const perm = await Notification.requestPermission();
  if (perm === 'granted') {
    localStorage.setItem(NOTIFY_KEY, 'true');
    return 'granted';
  }
  return perm;
}

function isNotificationEnabled() {
  return localStorage.getItem(NOTIFY_KEY) === 'true' && Notification.permission === 'granted';
}

function sendNotification(title, body) {
  if (!isNotificationEnabled()) return;
  if (navigator.serviceWorker && navigator.serviceWorker.controller) {
    navigator.serviceWorker.ready.then(reg => {
      reg.showNotification(title, {
        body,
        icon: './assets/icons/icon-192.png',
        badge: './assets/icons/icon-192.png',
        tag: 'food-reminder'
      });
    });
  } else {
    new Notification(title, { body, icon: './assets/icons/icon-192.png' });
  }
}

function checkExpiryNotifications(foods, warnDays) {
  if (!isNotificationEnabled() || !foods.length) return;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const warnDate = new Date(today);
  warnDate.setDate(warnDate.getDate() + warnDays);

  const expiringSoon = foods.filter(f => {
    const d = new Date(f.expiry);
    d.setHours(0, 0, 0, 0);
    return d <= warnDate && d >= today;
  });

  const expired = foods.filter(f => {
    const d = new Date(f.expiry);
    d.setHours(0, 0, 0, 0);
    return d < today;
  });

  if (expired.length) {
    sendNotification('æ¤ç·æ§å®¸è¶ç¹é?, `${expired.length} æµ å î¤éä½¸å¡æ©å¨æ¹¡éå²î¬éå©æ¤å¨å¯æ`);
  } else if (expiringSoon.length) {
    sendNotification('æ¤ç·æ§éå²ç¢æ©å¨æ¹¡', `${expiringSoon.length} æµ å î¤éä½¸æ¹ª ${warnDays} æ¾¶âå´éçæ¹¡`);
  }
}
