function runCompare() {
  var eikEl1 = document.getElementById('eik1');
  var eikEl2 = document.getElementById('eik2');
  var avgEl1 = document.getElementById('average1');
  var avgEl2 = document.getElementById('average2');

  if (!eikEl1 && !eikEl2) return;
  if (!avgEl1 && !avgEl2) return;

  var eikStr = eikEl1 && eikEl1.value !== '' ? eikEl1.value : (eikEl2 ? eikEl2.value : '');
  var avgStr = avgEl1 && avgEl1.value !== '' ? avgEl1.value : (avgEl2 ? avgEl2.value : '');

  var eik = Number(eikStr);
  var avg = Number(avgStr);

  if (isNaN(eik) || isNaN(avg)) return;

  var delta = eik - avg;
  var deltaPct;
  if (avg === 0) {
    deltaPct = 0;
  } else {
    deltaPct = (delta / avg) * 100;
  }

  var absEl = document.getElementById('deltaAbs');
  if (absEl) {
    absEl.textContent = delta.toFixed(1) + ' kWh/㎡·yr';
  }

  var pctEl = document.getElementById('deltaPct');
  if (pctEl) {
    pctEl.textContent = deltaPct.toFixed(1) + ' %';
  }

  // (옵션) 막대 차트
  var canvas = document.getElementById('intensityChart');
  if (canvas && window.Chart) {
    if (window.__intensityChart && typeof window.__intensityChart.destroy === 'function') {
      window.__intensityChart.destroy();
    }
    window.__intensityChart = new window.Chart(canvas, {
      type: 'bar',
      data: {
        labels: ['선택(EIK)', '카테고리 평균'],
        datasets: [{ label: 'kWh/㎡·yr', data: [eik, avg] }]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true } }
      }
    });
  }
}