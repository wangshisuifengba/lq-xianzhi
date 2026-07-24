// 临期先知 — Pro 状态管理 + 支付
(function() {
  'use strict';

  const UNLOCK_CODES = ['LQ8888', 'FRESH01', 'WASTE02', 'PRO2026', 'PANTRY9'];

  async function isPro() {
    return await LQDB.getSetting('proUnlocked', false);
  }

  async function unlockWithCode(code) {
    if (!code || code.length !== 6) {
      return { ok: false, msg: '请输入 6 位解锁码' };
    }
    const normalized = code.toUpperCase().trim();
    if (UNLOCK_CODES.includes(normalized)) {
      await LQDB.setSetting('proUnlocked', true);
      await LQDB.setSetting('unlockCode', normalized);
      await LQDB.setSetting('unlockedAt', Date.now());
      return { ok: true };
    }
    return { ok: false, msg: '解锁码无效' };
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