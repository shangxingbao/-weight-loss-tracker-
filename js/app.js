/**
 * 轻盈笔记 — 主应用逻辑
 * 页面切换、数据录入、历史渲染、目标设定
 */

// ====== 工具函数 ======

/** 获取今天的日期字符串 */
function todayStr() {
  return formatDate(new Date());
}

/** 计算 BMI */
function calcBMI(weightKg, heightCm) {
  if (!weightKg || !heightCm || heightCm <= 0) return null;
  const h = heightCm / 100;
  return Math.round((weightKg / (h * h)) * 10) / 10;
}

/** BMI 评价 */
function bmiLabel(bmi) {
  if (!bmi) return '';
  if (bmi < 18.5) return '偏瘦';
  if (bmi < 24) return '正常';
  if (bmi < 28) return '偏胖';
  return '肥胖';
}

/** 运动 MET 值映射 */
const MET_VALUES = {
  '跑步': 8.0,
  '走路': 3.5,
  '骑行': 6.0,
  '游泳': 7.0,
  '力量训练': 5.0,
  '自定义': 0,
};

/** 估算运动消耗热量 */
function estimateCalories(type, durationMin, weightKg) {
  const met = MET_VALUES[type] || 5;
  if (met === 0) return 0; // 自定义让用户自己填
  return Math.round(met * weightKg * (durationMin / 60));
}

/** 获取本周起止日期 */
function getWeekRange(offset = 0) {
  const now = new Date();
  const dayOfWeek = now.getDay() || 7; // 周一=1 ... 周日=7
  const monday = new Date(now);
  monday.setDate(now.getDate() - dayOfWeek + 1 + offset * 7);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { start: monday, end: sunday };
}

/** 格式化周范围显示 */
function formatWeekRange(week) {
  const s = week.start;
  const e = week.end;
  return `${s.getMonth() + 1}/${s.getDate()} - ${e.getMonth() + 1}/${e.getDate()}`;
}

// ====== 全局状态 ======
let historyWeekOffset = 0;

// ====== 页面切换 ======

function switchPage(pageId) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));

  const page = document.getElementById(pageId);
  if (page) page.classList.add('active');

  const tab = document.querySelector(`[data-page="${pageId}"]`);
  if (tab) tab.classList.add('active');

  // 更新标题
  const titles = {
    'page-record': '轻盈笔记',
    'page-history': '历史记录',
    'page-trends': '趋势图表',
  };
  document.getElementById('page-title').textContent = titles[pageId] || '轻盈笔记';

  // 切换到趋势页时刷新图表
  if (pageId === 'page-trends') {
    // 重置为7天视图
    document.querySelectorAll('.chart-tab').forEach(t => t.classList.remove('active'));
    const defaultTab = document.querySelector('.chart-tab[data-range="7"]');
    if (defaultTab) defaultTab.classList.add('active');
    currentRange = 7;
    refreshCharts();
  }
  // 切换到历史页时刷新列表
  if (pageId === 'page-history') {
    renderHistory();
  }
}

// ====== 模态框 ======

function openModal(modalId) {
  document.getElementById(modalId).classList.add('show');
}

function closeModal(modalId) {
  document.getElementById(modalId).classList.remove('show');
}

function closeAllModals() {
  document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('show'));
}

// ====== 记录页：摘要刷新 ======

async function refreshSummary() {
  const today = todayStr();

  // 今日体重
  const weightRecord = await getWeight(today);
  const latestWeight = weightRecord ? weightRecord.weight : null;

  if (latestWeight) {
    document.getElementById('today-weight').textContent = `${latestWeight} kg`;
  } else {
    document.getElementById('today-weight').textContent = '-- kg';
  }

  // 相比上次变化
  const allWeights = await getAllWeights();
  const changeEl = document.getElementById('weight-change');
  if (allWeights.length >= 2) {
    const lastTwo = allWeights.slice(-2);
    const diff = Math.round((lastTwo[1].weight - lastTwo[0].weight) * 10) / 10;
    if (diff < 0) {
      changeEl.textContent = `↓ ${Math.abs(diff)} kg`;
      changeEl.className = 'summary-change down';
    } else if (diff > 0) {
      changeEl.textContent = `↑ ${diff} kg`;
      changeEl.className = 'summary-change up';
    } else {
      changeEl.textContent = '持平';
      changeEl.className = 'summary-change';
    }
  } else {
    changeEl.textContent = '';
    changeEl.className = 'summary-change';
  }

  // 今日热量
  const [meals, exercises] = await Promise.all([
    getMealsByDate(today),
    getExercisesByDate(today),
  ]);
  const totalIn = meals.reduce((sum, m) => sum + m.calories, 0);
  const totalOut = exercises.reduce((sum, e) => sum + e.calories, 0);
  document.getElementById('today-cal-in').textContent = totalIn;
  document.getElementById('today-cal-out').textContent = totalOut;

  // 目标进度
  await refreshGoalProgress(latestWeight);
}

/** 刷新目标进度 */
async function refreshGoalProgress(currentWeight) {
  const goalWeight = await getSetting('goalWeight');
  const goalDate = await getSetting('goalDate');
  const height = await getSetting('height');

  const goalCard = document.getElementById('goal-card');

  if (!goalWeight) {
    document.getElementById('goal-weight-display').textContent = '未设定';
    document.getElementById('goal-remaining').textContent = '';
    document.getElementById('goal-progress-bar').style.width = '0%';
    document.getElementById('bmi-display').textContent = height ? '请在设置中设定目标体重' : '请在设置中设定身高和目标';
    return;
  }

  document.getElementById('goal-weight-display').textContent = `${goalWeight} kg`;

  // 起始体重（取最早记录）
  const allWeights = await getAllWeights();
  const startWeight = allWeights.length > 0 ? allWeights[0].weight : currentWeight;

  if (currentWeight && startWeight) {
    const totalToLose = startWeight - parseFloat(goalWeight);
    const lost = startWeight - currentWeight;
    const pct = totalToLose > 0 ? Math.min(100, Math.max(0, Math.round((lost / totalToLose) * 100))) : 0;
    document.getElementById('goal-progress-bar').style.width = `${pct}%`;

    const remaining = Math.round((currentWeight - parseFloat(goalWeight)) * 10) / 10;
    if (remaining <= 0) {
      document.getElementById('goal-remaining').textContent = '🎉 已达成!';
    } else {
      document.getElementById('goal-remaining').textContent = `还需减 ${remaining} kg`;
    }
  }

  // BMI
  if (currentWeight && height) {
    const bmi = calcBMI(currentWeight, parseFloat(height));
    document.getElementById('bmi-display').textContent = `BMI: ${bmi} (${bmiLabel(bmi)})`;
  } else {
    document.getElementById('bmi-display').textContent = '';
  }
}

// ====== 体重录入 ======

function setupWeightModal() {
  document.getElementById('btn-add-weight').addEventListener('click', () => {
    document.getElementById('weight-date').value = todayStr();
    document.getElementById('weight-value').value = '';
    document.getElementById('weight-note').value = '';
    openModal('modal-weight');
  });

  document.getElementById('btn-save-weight').addEventListener('click', async () => {
    const date = document.getElementById('weight-date').value;
    const weight = parseFloat(document.getElementById('weight-value').value);
    const note = document.getElementById('weight-note').value.trim();

    if (!date) { alert('请选择日期'); return; }
    if (!weight || weight < 20 || weight > 300) { alert('请输入有效的体重 (20-300 kg)'); return; }

    await saveWeight({ date, weight, note });
    closeModal('modal-weight');
    await refreshSummary();
  });
}

// ====== 饮食录入 ======

function setupMealModal() {
  document.getElementById('btn-add-meal').addEventListener('click', () => {
    document.getElementById('meal-date').value = todayStr();
    document.getElementById('meal-food').value = '';
    document.getElementById('meal-calories').value = '';
    resetChips('meal-type-chips');
    openModal('modal-meal');
  });

  // 餐次选择
  document.querySelectorAll('#meal-type-chips .chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('#meal-type-chips .chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
    });
  });

  // 预设食物快捷选择
  document.querySelectorAll('.preset-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.getElementById('meal-food').value = chip.dataset.food;
      document.getElementById('meal-calories').value = chip.dataset.cal;
    });
  });

  document.getElementById('btn-save-meal').addEventListener('click', async () => {
    const date = document.getElementById('meal-date').value;
    const food = document.getElementById('meal-food').value.trim();
    const calories = parseInt(document.getElementById('meal-calories').value);
    const mealType = document.querySelector('#meal-type-chips .chip.active')?.dataset.value || '早餐';

    if (!date) { alert('请选择日期'); return; }
    if (!food) { alert('请输入食物名称'); return; }
    if (!calories || calories < 0 || calories > 5000) { alert('请输入有效的热量值 (0-5000 kcal)'); return; }

    await saveMeal({ date, mealType, food, calories });
    closeModal('modal-meal');
    await refreshSummary();
  });
}

// ====== 运动录入 ======

function setupExerciseModal() {
  document.getElementById('btn-add-exercise').addEventListener('click', () => {
    document.getElementById('exercise-date').value = todayStr();
    document.getElementById('exercise-duration').value = '';
    document.getElementById('exercise-calories').value = '';
    document.getElementById('est-calories').textContent = '';
    resetChips('exercise-type-chips');
    openModal('modal-exercise');
  });

  // 运动类型选择
  document.querySelectorAll('#exercise-type-chips .chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('#exercise-type-chips .chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      // 自动估算
      autoEstimateCalories();
    });
  });

  // 时长变化时自动估算
  document.getElementById('exercise-duration').addEventListener('input', autoEstimateCalories);

  document.getElementById('btn-save-exercise').addEventListener('click', async () => {
    const date = document.getElementById('exercise-date').value;
    const type = document.querySelector('#exercise-type-chips .chip.active')?.dataset.value || '自定义';
    const duration = parseInt(document.getElementById('exercise-duration').value);
    const calories = parseInt(document.getElementById('exercise-calories').value);

    if (!date) { alert('请选择日期'); return; }
    if (!duration || duration < 1 || duration > 600) { alert('请输入有效的时长 (1-600 分钟)'); return; }
    if (!calories || calories < 0 || calories > 5000) { alert('请输入有效的热量值 (0-5000 kcal)'); return; }

    await saveExercise({ date, type, duration, calories });
    closeModal('modal-exercise');
    await refreshSummary();
  });
}

async function autoEstimateCalories() {
  const type = document.querySelector('#exercise-type-chips .chip.active')?.dataset.value || '跑步';
  const duration = parseInt(document.getElementById('exercise-duration').value) || 0;

  if (type === '自定义') {
    document.getElementById('est-calories').textContent = '';
    return;
  }

  // 用最新体重估算
  const today = todayStr();
  const w = await getWeight(today);
  const all = await getAllWeights();
  const weight = w?.weight || (all.length > 0 ? all[all.length - 1].weight : 70);
  const est = estimateCalories(type, duration, weight);
  document.getElementById('est-calories').textContent = est > 0 ? `估算: ${est} kcal` : '';
  document.getElementById('exercise-calories').placeholder = est > 0 ? `估算值: ${est}` : '手动输入';
}

function resetChips(groupId) {
  const chips = document.querySelectorAll(`#${groupId} .chip`);
  chips.forEach((c, i) => c.classList.toggle('active', i === 0));
}

// ====== 历史页 ======

async function renderHistory() {
  const { start, end } = getWeekRange(historyWeekOffset);
  document.getElementById('history-range').textContent = formatWeekRange({ start, end });

  const startStr = formatDate(start);
  const endStr = formatDate(end);

  const [weights, meals, exercises] = await Promise.all([
    getWeightsInRange(startStr, endStr),
    getMealsInRange(startStr, endStr),
    getExercisesInRange(startStr, endStr),
  ]);

  // 按日期分组
  const dateMap = {};

  weights.forEach(w => {
    if (!dateMap[w.date]) dateMap[w.date] = { date: w.date, items: [] };
    dateMap[w.date].items.push({
      type: 'weight', icon: '⚖️', title: `体重记录`,
      detail: w.note || '', right: `${w.weight} kg`, id: w.date,
    });
  });

  meals.forEach(m => {
    if (!dateMap[m.date]) dateMap[m.date] = { date: m.date, items: [] };
    dateMap[m.date].items.push({
      type: 'meal', icon: '🍽️', title: `${m.mealType}: ${m.food}`,
      detail: '', right: `${m.calories} kcal`, id: m.id,
    });
  });

  exercises.forEach(e => {
    if (!dateMap[e.date]) dateMap[e.date] = { date: e.date, items: [] };
    dateMap[e.date].items.push({
      type: 'exercise', icon: '🏃', title: `${e.type} ${e.duration}分钟`,
      detail: '', right: `${e.calories} kcal`, id: e.id,
    });
  });

  const dates = Object.keys(dateMap).sort().reverse();
  const container = document.getElementById('history-list');

  if (dates.length === 0) {
    container.innerHTML = '<p class="empty-hint">本周暂无记录，开始记录吧 💪</p>';
    return;
  }

  container.innerHTML = dates.map(date => {
    const day = dateMap[date];
    const dayOfWeek = ['日', '一', '二', '三', '四', '五', '六'][new Date(date).getDay()];
    const itemsHtml = day.items.map(item => `
      <div class="history-item">
        <span class="history-item-icon">${item.icon}</span>
        <div class="history-item-info">
          <div>${item.title}</div>
          ${item.detail ? `<div class="history-item-detail">${item.detail}</div>` : ''}
        </div>
        <div class="history-item-right">${item.right}</div>
        <button class="history-item-del" data-type="${item.type}" data-id="${item.id}" title="删除">🗑️</button>
      </div>
    `).join('');
    return `
      <div class="history-day">
        <div class="history-day-title">${date} 周${dayOfWeek}</div>
        ${itemsHtml}
      </div>
    `;
  }).join('');

  // 绑定删除事件
  container.querySelectorAll('.history-item-del').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('确定要删除这条记录吗？')) return;
      const type = btn.dataset.type;
      const id = btn.dataset.id;
      if (type === 'weight') await deleteWeight(id);
      else if (type === 'meal') await deleteMeal(Number(id));
      else if (type === 'exercise') await deleteExercise(Number(id));
      await renderHistory();
      await refreshSummary();
    });
  });
}

// ====== 历史周导航 ======

function setupHistoryNav() {
  document.getElementById('btn-prev-week').addEventListener('click', () => {
    historyWeekOffset--;
    renderHistory();
  });
  document.getElementById('btn-next-week').addEventListener('click', () => {
    if (historyWeekOffset < 0) {
      historyWeekOffset++;
      renderHistory();
    }
  });
}

// ====== 趋势页 ======

function setupTrendsTabs() {
  document.querySelectorAll('.chart-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.chart-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const rangeStr = tab.dataset.range;
      if (rangeStr === 'all') {
        updateWeightChartAll();
        updateCalorieChartAll();
      } else {
        updateWeightChart(parseInt(rangeStr));
        updateCalorieChart(parseInt(rangeStr));
      }
    });
  });
}

async function updateWeightChartAll() {
  const allWeights = await getAllWeights();
  const labels = allWeights.map(w => w.date);
  const data = allWeights.map(w => w.weight);

  const goalWeight = await getSetting('goalWeight');
  const goalData = goalWeight ? labels.map(() => parseFloat(goalWeight)) : [];

  const ctx = document.getElementById('weightChart').getContext('2d');

  if (weightChart) weightChart.destroy();

  const datasets = [{
    label: '体重 (kg)',
    data: data,
    borderColor: '#4CAF50',
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
    borderWidth: 2.5,
    pointRadius: 5,
    pointBackgroundColor: '#4CAF50',
    pointBorderColor: '#fff',
    pointBorderWidth: 2,
    pointHoverRadius: 7,
    tension: 0.3,
    fill: true,
    spanGaps: false,
  }];

  if (goalData.length > 0) {
    datasets.push({
      label: '目标体重 (kg)',
      data: goalData,
      borderColor: '#FF9800',
      borderWidth: 2,
      borderDash: [6, 3],
      pointRadius: 0,
      fill: false,
    });
  }

  weightChart = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: { boxWidth: 12, padding: 16, font: { size: 11 }, usePointStyle: true },
        },
      },
      scales: {
        y: {
          title: { display: true, text: 'kg', font: { size: 11 } },
          grace: '5%',
        },
        x: {
          ticks: { maxTicksLimit: 10, font: { size: 10 } },
        },
      },
    },
  });
}

async function updateCalorieChartAll() {
  const allMeals = await (async () => {
    await ensureDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('meals', 'readonly');
      const results = [];
      tx.objectStore('meals').openCursor().onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) { results.push(cursor.value); cursor.continue(); }
        else { resolve(results); }
      };
      tx.onerror = (e) => reject(e.target.error);
    });
  })();

  const allExercises = await (async () => {
    await ensureDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('exercises', 'readonly');
      const results = [];
      tx.objectStore('exercises').openCursor().onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) { results.push(cursor.value); cursor.continue(); }
        else { resolve(results); }
      };
      tx.onerror = (e) => reject(e.target.error);
    });
  })();

  const calIn = {};
  const calOut = {};
  allMeals.forEach(m => { calIn[m.date] = (calIn[m.date] || 0) + m.calories; });
  allExercises.forEach(e => { calOut[e.date] = (calOut[e.date] || 0) + e.calories; });

  const allDates = [...new Set([...Object.keys(calIn), ...Object.keys(calOut)])].sort();
  const inData = allDates.map(date => calIn[date] || 0);
  const outData = allDates.map(date => calOut[date] || 0);

  const ctx = document.getElementById('calorieChart').getContext('2d');
  if (calorieChart) calorieChart.destroy();

  calorieChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: allDates,
      datasets: [
        {
          label: '摄入 (kcal)',
          data: inData,
          backgroundColor: 'rgba(255, 152, 0, 0.7)',
          borderColor: '#FB8C00',
          borderWidth: 1,
          borderRadius: 6,
        },
        {
          label: '消耗 (kcal)',
          data: outData,
          backgroundColor: 'rgba(66, 165, 245, 0.7)',
          borderColor: '#1E88E5',
          borderWidth: 1,
          borderRadius: 6,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: { boxWidth: 12, padding: 16, font: { size: 11 }, usePointStyle: true },
        },
      },
      scales: {
        y: {
          title: { display: true, text: 'kcal', font: { size: 11 } },
          beginAtZero: true,
        },
        x: {
          ticks: { maxTicksLimit: 10, font: { size: 10 } },
        },
      },
    },
  });
}

// ====== 设置 ======

function setupSettings() {
  document.getElementById('btn-settings').addEventListener('click', async () => {
    const height = await getSetting('height');
    const goalWeight = await getSetting('goalWeight');
    const goalDate = await getSetting('goalDate');

    document.getElementById('setting-height').value = height || '';
    document.getElementById('setting-goal-weight').value = goalWeight || '';
    document.getElementById('setting-goal-date').value = goalDate || '';

    // 显示/隐藏手动安装按钮
    const installBtn = document.getElementById('btn-install-manual');
    if (deferredPrompt || window.matchMedia('(display-mode: standalone)').matches) {
      installBtn.style.display = 'none';
    } else {
      installBtn.style.display = 'block';
    }

    openModal('modal-settings');
  });

  document.getElementById('btn-install-manual').addEventListener('click', async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const result = await deferredPrompt.userChoice;
      deferredPrompt = null;
      document.getElementById('btn-install-manual').style.display = 'none';
      if (result.outcome === 'accepted') {
        alert('安装成功！');
      } else {
        alert('已取消。你可以随时在浏览器菜单中选择"添加到桌面"来安装。');
      }
    } else {
      alert('请在浏览器菜单中选择"添加到桌面"来安装。\n\nChrome: 菜单 → 添加到主屏幕\n夸克: 菜单 → 添加到桌面');
    }
  });

  document.getElementById('btn-save-settings').addEventListener('click', async () => {
    const height = document.getElementById('setting-height').value;
    const goalWeight = document.getElementById('setting-goal-weight').value;
    const goalDate = document.getElementById('setting-goal-date').value;

    if (height) await saveSetting('height', height);
    if (goalWeight) await saveSetting('goalWeight', goalWeight);
    if (goalDate) await saveSetting('goalDate', goalDate);

    closeModal('modal-settings');
    await refreshSummary();
    alert('设置已保存 ✅');
  });
}

// ====== 模态框关闭 ======

function setupModalClose() {
  // 点击关闭按钮
  document.querySelectorAll('.modal-close').forEach(btn => {
    btn.addEventListener('click', () => {
      closeAllModals();
    });
  });

  // 点击遮罩关闭
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeAllModals();
    });
  });
}

// ====== PWA 安装提示 ======

let deferredPrompt = null;

function setupPWAInstall() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;

    // 创建安装横幅
    const banner = document.createElement('div');
    banner.id = 'install-banner';
    banner.innerHTML = `
      <span class="banner-text">📲 添加到手机桌面</span>
      <button class="btn-install" id="btn-install">安装</button>
      <button class="btn-dismiss" id="btn-dismiss-install">✕</button>
    `;
    document.body.appendChild(banner);
    setTimeout(() => banner.classList.add('show'), 1000);

    document.getElementById('btn-install').addEventListener('click', async () => {
      if (deferredPrompt) {
        deferredPrompt.prompt();
        const result = await deferredPrompt.userChoice;
        console.log('PWA install:', result.outcome);
        deferredPrompt = null;
        banner.remove();
      }
    });

    document.getElementById('btn-dismiss-install').addEventListener('click', () => {
      banner.remove();
    });
  });
}

// ====== 应用初始化 ======

async function initApp() {
  // 初始化数据库
  await openDB();

  // 设置页面切换
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchPage(btn.dataset.page));
  });

  // 设置各模态框
  setupWeightModal();
  setupMealModal();
  setupExerciseModal();
  setupSettings();
  setupModalClose();

  // 设置历史导航
  setupHistoryNav();

  // 设置趋势 Tab
  setupTrendsTabs();

  // 设置 PWA 安装
  setupPWAInstall();

  // 注册 Service Worker
  if ('serviceWorker' in navigator) {
    try {
      await navigator.serviceWorker.register('sw.js');
      console.log('Service Worker registered');
    } catch (e) {
      console.log('Service Worker registration failed:', e);
    }
  }

  // 刷新首页数据
  await refreshSummary();

  // 默认显示记录页
  switchPage('page-record');
}

// 启动
document.addEventListener('DOMContentLoaded', initApp);
