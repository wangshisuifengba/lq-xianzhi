// ä¸´æåç¥ â Pro ç¶æç®¡ç
'use strict';

const VALID_CODES = ['123456', '888888', '000000'];

function isPro() {
  return localStorage.getItem('lq_pro_unlocked') === 'true';
}

function unlockPro(code) {
  const normalized = (code || '').trim();
  if (VALID_CODES.includes(normalized)) {
    localStorage.setItem('lq_pro_unlocked', 'true');
    return true;
  }
  return false;
}

function checkFoodLimit() {
  if (isPro()) return { ok: true, remaining: Infinity, limit: Infinity };
  const count = countActiveFood();
  const FREE_LIMIT = 50;
  return {
    ok: count < FREE_LIMIT,
    remaining: Math.max(0, FREE_LIMIT - count),
    limit: FREE_LIMIT
  };
}

function getRemainingSlots() {
  if (isPro()) return Infinity;
  const count = countActiveFood();
  return Math.max(0, 50 - count);
}

function countActiveFood() {
  try {
    const foods = JSON.parse(localStorage.getItem('lq_foods') || '[]');
    return foods.filter(function(f) { return !f.archived; }).length;
  } catch (e) {
    return 0;
  }
}ï»¿// ä¸´æåç¥ â Pro ç¶æç®¡ç + æ¯ä»
(function() {
  'use strict';

  const UNLOCK_CODES = ['LQ8888', 'FRESH01', 'WASTE02', 'PRO2026', 'PANTRY9'];

  async function isPro() {
    return await LQDB.getSetting('proUnlocked', false);
  }

  async function unlockWithCode(code) {
    if (!code || code.length !== 6) {
      return { ok: false, msg: 'è¯·è¾å¥ 6 ä½è§£éç ' };
    }
    const normalized = code.toUpperCase().trim();
    if (UNLOCK_CODES.includes(normalized)) {
      await LQDB.setSetting('proUnlocked', true);
      await LQDB.setSetting('unlockCode', normalized);
      await LQDB.setSetting('unlockedAt', Date.now());
      return { ok: true };
    }
    return { ok: false, msg: 'è§£éç æ æ' };
  }

  async function checkLimit() {
    const pro = await isPro();
    if (pro) return { ok: true, remaining: Infinity };
    const count = await LQDB.countActive();
    const FREE_LIMIT = 50;
    return {
      ok: count < FREE_LIMIT,
      remaining: Math.max(0, FREE_LIMIT - count),
      limit: FREE_LIMIT
    };
  }

  window.LQPro = { isPro, unlockWithCode, checkLimit };
})();
