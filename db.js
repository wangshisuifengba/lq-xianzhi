// 临期先知 — IndexedDB 数据层
// 使用全局 idb（UMD）库
(function() {
  'use strict';

  const DB_NAME = 'lqxianzhi';
  const DB_VERSION = 1;
  const STORE_FOODS = 'foods';
  const STORE_SETTINGS = 'settings';
  const STORE_HISTORY = 'history';

  let dbPromise = null;

  function getDB() {
    if (!dbPromise) {
      dbPromise = idb.openDB(DB_NAME, DB_VERSION, {
        upgrade(db) {
          if (!db.objectStoreNames.contains(STORE_FOODS)) {
            const store = db.createObjectStore(STORE_FOODS, { keyPath: 'id' });
            store.createIndex('expiry', 'expiry');
            store.createIndex('category', 'category');
            store.createIndex('consumed', 'consumed');
          }
          if (!db.objectStoreNames.contains(STORE_SETTINGS)) {
            db.createObjectStore(STORE_SETTINGS, { keyPath: 'key' });
          }
          if (!db.objectStoreNames.contains(STORE_HISTORY)) {
            const hStore = db.createObjectStore(STORE_HISTORY, { keyPath: 'id' });
            hStore.createIndex('consumedAt', 'consumedAt');
          }
        }
      });
    }
    return dbPromise;
  }

  // ===== 食品 CRUD =====
  async function addFood(food) {
    const db = await getDB();
    const record = {
      id: 'f_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
      name: food.name,
      category: food.category || '其他',
      expiry: food.expiry,
      qty: food.qty || 1,
      unit: food.unit || '个',
      note: food.note || '',
      barcode: food.barcode || '',
      consumed: false,
      createdAt: Date.now()
    };
    await db.put(STORE_FOODS, record);
    return record;
  }

  async function updateFood(id, patch) {
    const db = await getDB();
    const existing = await db.get(STORE_FOODS, id);
    if (!existing) throw new Error('食品不存在');
    const updated = { ...existing, ...patch, updatedAt: Date.now() };
    await db.put(STORE_FOODS, updated);
    return updated;
  }

  async function deleteFood(id) {
    const db = await getDB();
    await db.delete(STORE_FOODS, id);
  }

  async function getFood(id) {
    const db = await getDB();
    return db.get(STORE_FOODS, id);
  }

  async function getAllFoods() {
    const db = await getDB();
    return db.getAll(STORE_FOODS);
  }

  async function getActiveFoods() {
    const all = await getAllFoods();
    return all.filter(f => !f.consumed);
  }

  // 标记已消耗（移入历史）
  async function consumeFood(id) {
    const db = await getDB();
    const item = await db.get(STORE_FOODS, id);
    if (!item) return;
    const consumedAt = Date.now();
    const historyRecord = {
      id: 'h_' + consumedAt + '_' + Math.random().toString(36).slice(2, 6),
      originalId: item.id,
      name: item.name,
      category: item.category,
      expiry: item.expiry,
      qty: item.qty,
      unit: item.unit,
      consumedAt,
      daysBeforeExpiry: Math.floor((new Date(item.expiry) - consumedAt) / (24 * 60 * 60 * 1000))
    };
    const tx = db.transaction([STORE_FOODS, STORE_HISTORY], 'readwrite');
    await tx.objectStore(STORE_HISTORY).put(historyRecord);
    await tx.objectStore(STORE_FOODS).delete(id);
    await tx.done;
  }

  // 撤销最近一次消耗
  async function undoLastConsume() {
    const db = await getDB();
    const all = await db.getAllFromIndex(STORE_HISTORY, 'consumedAt');
    if (all.length === 0) return null;
    const last = all.sort((a, b) => b.consumedAt - a.consumedAt)[0];
    const tx = db.transaction([STORE_FOODS, STORE_HISTORY], 'readwrite');
    const restored = {
      id: last.originalId || 'f_restored_' + Date.now(),
      name: last.name,
      category: last.category,
      expiry: last.expiry,
      qty: last.qty,
      unit: last.unit,
      note: '',
      consumed: false,
      createdAt: last.consumedAt,
      restoredAt: Date.now()
    };
    await tx.objectStore(STORE_FOODS).put(restored);
    await tx.objectStore(STORE_HISTORY).delete(last.id);
    await tx.done;
    return restored;
  }

  async function getHistory(limit = 100) {
    const db = await getDB();
    const all = await db.getAll(STORE_HISTORY);
    return all.sort((a, b) => b.consumedAt - a.consumedAt).slice(0, limit);
  }

  // ===== 设置 =====
  async function getSetting(key, defaultValue) {
    const db = await getDB();
    const record = await db.get(STORE_SETTINGS, key);
    return record ? record.value : defaultValue;
  }

  async function setSetting(key, value) {
    const db = await getDB();
    await db.put(STORE_SETTINGS, { key, value, updatedAt: Date.now() });
  }

  // ===== 导入导出 =====
  async function exportAll() {
    const foods = await getAllFoods();
    const history = await getHistory(1000);
    const settings = {};
    const warnDays = await getSetting('warnDays', 3);
    const avgPrice = await getSetting('avgPrice', 15);
    const proUnlocked = await getSetting('proUnlocked', false);
    settings.warnDays = warnDays;
    settings.avgPrice = avgPrice;
    settings.proUnlocked = proUnlocked;
    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      foods,
      history,
      settings
    };
  }

  async function importAll(data, merge = false) {
    if (!data || !data.foods) throw new Error('数据格式错误');
    const db = await getDB();
    const tx = db.transaction([STORE_FOODS, STORE_HISTORY, STORE_SETTINGS], 'readwrite');

    if (!merge) {
      await tx.objectStore(STORE_FOODS).clear();
      await tx.objectStore(STORE_HISTORY).clear();
    }

    for (const food of data.foods) {
      await tx.objectStore(STORE_FOODS).put(food);
    }
    if (data.history) {
      for (const h of data.history) {
        await tx.objectStore(STORE_HISTORY).put(h);
      }
    }
    if (data.settings) {
      for (const [k, v] of Object.entries(data.settings)) {
        await tx.objectStore(STORE_SETTINGS).put({ key: k, value: v });
      }
    }
    await tx.done;
  }

  async function clearAll() {
    const db = await getDB();
    const tx = db.transaction([STORE_FOODS, STORE_HISTORY, STORE_SETTINGS], 'readwrite');
    await tx.objectStore(STORE_FOODS).clear();
    await tx.objectStore(STORE_HISTORY).clear();
    await tx.done;
  }

  async function countActive() {
    const all = await getActiveFoods();
    return all.length;
  }

  // 暴露到全局
  window.LQDB = {
    addFood,
    updateFood,
    deleteFood,
    getFood,
    getAllFoods,
    getActiveFoods,
    consumeFood,
    undoLastConsume,
    getHistory,
    getSetting,
    setSetting,
    exportAll,
    importAll,
    clearAll,
    countActive
  };
})();