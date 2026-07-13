/**
 * 图表模块 — 基于 Chart.js
 * 体重趋势折线图 + 热量统计柱状图
 */

let weightChart = null;
let calorieChart = null;
let currentRange = 7; // 默认7天

/** 获取日期范围 */
function getDateRange(days) {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - days + 1);
  return {
    start: formatDate(start),
    end: formatDate(end),
  };
}

/** 生成日期数组 */
function getDateLabels(days) {
  const labels = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    labels.push(formatDate(d));
  }
  return labels;
}

/** 格式化日期 YYYY-MM-DD */
function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** 初始化/更新体重趋势图 */
async function updateWeightChart(days) {
  currentRange = days;
  const { start, end } = getDateRange(days);
  const labels = getDateLabels(days);
  const weights = await getWeightsInRange(start, end);

  // 构建数据点: 日期 → 体重
  const weightMap = {};
  weights.forEach(w => { weightMap[w.date] = w.weight; });

  const data = labels.map(date => weightMap[date] || null);

  // 获取目标体重
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
          ticks: { maxTicksLimit: 7, font: { size: 10 } },
        },
      },
    },
  });
}

/** 初始化/更新热量统计图 */
async function updateCalorieChart(days) {
  const { start, end } = getDateRange(days);
  const labels = getDateLabels(days);

  const [meals, exercises] = await Promise.all([
    getMealsInRange(start, end),
    getExercisesInRange(start, end),
  ]);

  // 按日期汇总
  const calIn = {};
  const calOut = {};
  meals.forEach(m => { calIn[m.date] = (calIn[m.date] || 0) + m.calories; });
  exercises.forEach(e => { calOut[e.date] = (calOut[e.date] || 0) + e.calories; });

  const inData = labels.map(date => calIn[date] || 0);
  const outData = labels.map(date => calOut[date] || 0);

  const ctx = document.getElementById('calorieChart').getContext('2d');

  if (calorieChart) calorieChart.destroy();

  calorieChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
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
          ticks: { maxTicksLimit: 7, font: { size: 10 } },
        },
      },
    },
  });
}

/** 同时更新所有图表 */
async function refreshCharts() {
  await updateWeightChart(currentRange);
  await updateCalorieChart(currentRange);
}
