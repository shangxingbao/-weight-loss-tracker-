/**
 * IndexedDB 封装 — 减肥记录 App 数据层
 * Database: WeightLossDB
 * ObjectStores: weights, meals, exercises, settings
 */

const DB_NAME = 'WeightLossDB';
const DB_VERSION = 1;

let db = null;

/** 打开数据库并初始化 */
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (e) => {
      const db = e.target.result;

      // 体重记录: keyPath = date (YYYY-MM-DD)
      if (!db.objectStoreNames.contains('weights')) {
        db.createObjectStore('weights', { keyPath: 'date' });
      }

      // 饮食记录: autoIncrement id
      if (!db.objectStoreNames.contains('meals')) {
        const mealStore = db.createObjectStore('meals', { keyPath: 'id', autoIncrement: true });
        mealStore.createIndex('date', 'date', { unique: false });
      }

      // 运动记录: autoIncrement id
      if (!db.objectStoreNames.contains('exercises')) {
        const exStore = db.createObjectStore('exercises', { keyPath: 'id', autoIncrement: true });
        exStore.createIndex('date', 'date', { unique: false });
      }

      // 设置: keyPath = key
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' });
      }
    };

    request.onsuccess = (e) => {
      db = e.target.result;
      resolve(db);
    };

    request.onerror = (e) => {
      console.error('IndexedDB open error:', e.target.error);
      reject(e.target.error);
    };
  });
}

/** 确保数据库已打开 */
async function ensureDB() {
  if (db) return db;
  return openDB();
}

// ====== 体重 CRUD ======

async function saveWeight(record) {
  await ensureDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('weights', 'readwrite');
    tx.objectStore('weights').put(record);
    tx.oncomplete = () => resolve(true);
    tx.onerror = (e) => reject(e.target.error);
  });
}

async function getWeight(date) {
  await ensureDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('weights', 'readonly');
    const req = tx.objectStore('weights').get(date);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = (e) => reject(e.target.error);
  });
}

async function getWeightsInRange(startDate, endDate) {
  await ensureDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('weights', 'readonly');
    const store = tx.objectStore('weights');
    const range = IDBKeyRange.bound(startDate, endDate);
    const results = [];
    const req = store.openCursor(range);
    req.onsuccess = (e) => {
      const cursor = e.target.result;
      if (cursor) { results.push(cursor.value); cursor.continue(); }
      else { resolve(results); }
    };
    req.onerror = (e) => reject(e.target.error);
  });
}

async function getAllWeights() {
  await ensureDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('weights', 'readonly');
    const results = [];
    const req = tx.objectStore('weights').openCursor();
    req.onsuccess = (e) => {
      const cursor = e.target.result;
      if (cursor) { results.push(cursor.value); cursor.continue(); }
      else { resolve(results.sort((a, b) => a.date.localeCompare(b.date))); }
    };
    req.onerror = (e) => reject(e.target.error);
  });
}

async function deleteWeight(date) {
  await ensureDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('weights', 'readwrite');
    tx.objectStore('weights').delete(date);
    tx.oncomplete = () => resolve(true);
    tx.onerror = (e) => reject(e.target.error);
  });
}

// ====== 饮食 CRUD ======

async function saveMeal(record) {
  await ensureDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('meals', 'readwrite');
    tx.objectStore('meals').add(record);
    tx.oncomplete = () => resolve(true);
    tx.onerror = (e) => reject(e.target.error);
  });
}

async function getMealsByDate(date) {
  await ensureDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('meals', 'readonly');
    const index = tx.objectStore('meals').index('date');
    const results = [];
    const req = index.openCursor(IDBKeyRange.only(date));
    req.onsuccess = (e) => {
      const cursor = e.target.result;
      if (cursor) { results.push(cursor.value); cursor.continue(); }
      else { resolve(results); }
    };
    req.onerror = (e) => reject(e.target.error);
  });
}

async function getMealsInRange(startDate, endDate) {
  await ensureDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('meals', 'readonly');
    const index = tx.objectStore('meals').index('date');
    const range = IDBKeyRange.bound(startDate, endDate);
    const results = [];
    const req = index.openCursor(range);
    req.onsuccess = (e) => {
      const cursor = e.target.result;
      if (cursor) { results.push(cursor.value); cursor.continue(); }
      else { resolve(results); }
    };
    req.onerror = (e) => reject(e.target.error);
  });
}

async function deleteMeal(id) {
  await ensureDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('meals', 'readwrite');
    tx.objectStore('meals').delete(id);
    tx.oncomplete = () => resolve(true);
    tx.onerror = (e) => reject(e.target.error);
  });
}

// ====== 运动 CRUD ======

async function saveExercise(record) {
  await ensureDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('exercises', 'readwrite');
    tx.objectStore('exercises').add(record);
    tx.oncomplete = () => resolve(true);
    tx.onerror = (e) => reject(e.target.error);
  });
}

async function getExercisesByDate(date) {
  await ensureDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('exercises', 'readonly');
    const index = tx.objectStore('exercises').index('date');
    const results = [];
    const req = index.openCursor(IDBKeyRange.only(date));
    req.onsuccess = (e) => {
      const cursor = e.target.result;
      if (cursor) { results.push(cursor.value); cursor.continue(); }
      else { resolve(results); }
    };
    req.onerror = (e) => reject(e.target.error);
  });
}

async function getExercisesInRange(startDate, endDate) {
  await ensureDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('exercises', 'readonly');
    const index = tx.objectStore('exercises').index('date');
    const range = IDBKeyRange.bound(startDate, endDate);
    const results = [];
    const req = index.openCursor(range);
    req.onsuccess = (e) => {
      const cursor = e.target.result;
      if (cursor) { results.push(cursor.value); cursor.continue(); }
      else { resolve(results); }
    };
    req.onerror = (e) => reject(e.target.error);
  });
}

async function deleteExercise(id) {
  await ensureDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('exercises', 'readwrite');
    tx.objectStore('exercises').delete(id);
    tx.oncomplete = () => resolve(true);
    tx.onerror = (e) => reject(e.target.error);
  });
}

// ====== 设置 CRUD ======

async function saveSetting(key, value) {
  await ensureDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('settings', 'readwrite');
    tx.objectStore('settings').put({ key, value });
    tx.oncomplete = () => resolve(true);
    tx.onerror = (e) => reject(e.target.error);
  });
}

async function getSetting(key) {
  await ensureDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('settings', 'readonly');
    const req = tx.objectStore('settings').get(key);
    req.onsuccess = () => resolve(req.result ? req.result.value : null);
    req.onerror = (e) => reject(e.target.error);
  });
}
