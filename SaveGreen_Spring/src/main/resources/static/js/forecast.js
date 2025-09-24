document.addEventListener('DOMContentLoaded', init);

let _loaderTimer = null;   // 진행률 루프용

async function init() {
  const buildingId = document.getElementById('page-data')?.dataset?.buildingId || '1';

  // 0) 로더 시작 (페이지 내 패널)
  showPanel(true);
  setModel('선형 회귀(Linear Regression)');
  setStatus('데이터 수집/로딩');
  startLoaderProgress();                 // 0→85% 사이 반복 증가

  try {
    // 1) API 호출
    const res = await fetch(`/api/buildings/${buildingId}/forecast?from=2024&to=2026`);
    if (!res.ok) throw new Error(`API ${res.status}`);
    const j = await res.json();

    // 중간 단계 업데이트
    setStatus('정규화/스케일링');  setStepActive(2);
    await tinyDelay();

    setStatus('모델 피팅 확인');    setStepActive(3);
    await tinyDelay();

    // 2) 렌더링
    setStatus('예측 결과 반영');
    applyBanner(j);
    fillKpis(j);

    setStatus('차트 준비 & 렌더링'); setStepActive(4);
    drawComboChart(j);
    fillSummary(j);
    setStepActive(5);

    // 3) 로더 완료 처리
    completeLoaderProgress();           // 100%로 채우고
    setTimeout(() => {
      showPanel(false);                 // 패널 닫기
      document.getElementById('result-section').classList.remove('hidden');
    }, 420);
  } catch (e) {
    console.error(e);
    completeLoaderProgress();
    showPanel(false);
    const b = document.getElementById('status-banner');
    b.className = 'banner not-recommend';
    document.getElementById('banner-message').textContent = '데이터를 불러오지 못했습니다.';
    document.getElementById('banner-badge').textContent = '비추천';
    document.getElementById('result-section').classList.remove('hidden');
  }

  // 히어로 비디오 가시성 제어
  bootHeroVideo();
}

/* ====== ML 패널 제어 ====== */
function showPanel(flag) {
  const el = document.getElementById('mlLoader');
  if (!el) return;
  el.style.display = flag ? 'block' : 'none';
  el.style.opacity = flag ? '1' : '0';
}

function setModel(name) {
  const el = document.getElementById('modelName');
  if (el) el.textContent = name;
}

function setStatus(txt) {
  const el = document.getElementById('mlStatusText');
  if (el) el.textContent = txt;
}

function setProgress(p) {
  const clamped = Math.max(0, Math.min(100, p));
  const bar = document.getElementById('progressBar');
  if (bar) {
    bar.style.width = clamped + '%';
    bar.setAttribute('aria-valuenow', clamped);
  }
  // 단계 점등
  const steps = document.querySelectorAll('.check');
  const activeIdx = Math.min(steps.length, Math.ceil(clamped / 20));
  steps.forEach((el, i) => {
    el.textContent = (i < activeIdx) ? '✓' : '•';
    el.style.background = (i < activeIdx)
      ? 'rgba(34,211,238,.22)'
      : 'rgba(34,211,238,.12)';
  });
}

function setStepActive(n) {
  // n: 1~5
  setProgress(Math.max(parseInt(document.getElementById('progressBar')?.getAttribute('aria-valuenow') || 0, 10), n * 20));
}

function startLoaderProgress() {
  setProgress(0);
  stopLoaderProgress(); // 기존 루프 정리
  _loaderTimer = setInterval(() => {
    const now = parseInt(document.getElementById('progressBar')?.getAttribute('aria-valuenow') || '0', 10);
    const next = now + (3 + Math.floor(Math.random() * 6)); // +3~8%
    setProgress(Math.min(85, next));                         // 85%까지만 유동 증가
  }, 320);
}

function stopLoaderProgress() {
  if (_loaderTimer) {
    clearInterval(_loaderTimer);
    _loaderTimer = null;
  }
}

function completeLoaderProgress() {
  stopLoaderProgress();
  setProgress(100);
}

/* ====== 페이지 렌더링 ====== */
function applyBanner(j) {
  const banner = document.getElementById('status-banner');
  const msgEl = document.getElementById('banner-message');
  const badge = document.getElementById('banner-badge');
  const label = (j.status?.label || '').toUpperCase();

  const MAP = {
    RECOMMEND:     { cls: 'recommend',     badge: '추천',   message: '투자 회수기간이 짧고 효과가 큽니다.' },
    CONDITIONAL:   { cls: 'conditional',   badge: '조건부', message: '효과는 있지만 추가 검토가 필요합니다.' },
    NOT_RECOMMEND: { cls: 'not-recommend', badge: '비추천', message: '현재 조건에서는 리모델링 효과가 제한적입니다.' }
  };
  const m = MAP[label] || MAP.RECOMMEND;

  banner.classList.remove('recommend', 'conditional', 'not-recommend');
  banner.classList.add(m.cls);
  msgEl.textContent = m.message;
  badge.textContent = m.badge;
}

function fillKpis(j) {
  setText('#kpi-saving-cost', fmtCurrency(j.kpi?.savingCostYr));
  setText('#kpi-saving-kwh', fmtNumber(j.kpi?.savingKwhYr));

  let pct = j.kpi?.savingPct;
  if (pct == null) {
    const before = j.series?.before ?? [];
    const saving = j.series?.saving ?? [];
    const idx = firstPositiveIndex(saving);
    if (idx >= 0 && before[idx]) pct = (saving[idx] / before[idx]) * 100;
  }
  setText('#kpi-saving-pct', pct != null ? fmtPercent(pct) : '-');
  setText('#kpi-payback', j.kpi?.paybackYears ?? '-');
}

/* 혼합 차트: Bar(절감 kWh/년) + Line 2개(Before/After kWh/년) */
function drawComboChart(j) {
  const years  = range(j.meta?.fromYear ?? 2024, j.meta?.toYear ?? 2026);
  const before = j.series?.before ?? [];
  const after  = j.series?.after ?? [];
  const saving = j.series?.saving ?? [];

  const ctx = document.getElementById('chart-energy-combo').getContext('2d');
  new Chart(ctx, {
    data: {
      labels: years,
      datasets: [
        {
          type: 'bar',
          label: '절감량 (kWh/년)',
          data: saving,
          borderRadius: 6
        },
        {
          type: 'line',
          label: 'Before (kWh/년)',
          data: before,
          fill: false,
          tension: 0.3,
          borderWidth: 2,
          pointRadius: 2
        },
        {
          type: 'line',
          label: 'After (kWh/년)',
          data: after,
          fill: false,
          tension: 0.3,
          borderWidth: 2,
          pointRadius: 2
        }
      ]
    },
    options: {
      responsive: true,
      animation: {
        duration: 900,
        easing: 'easeOutQuart'
      },
      scales: {
        y: { beginAtZero: true }
      },
      plugins: {
        tooltip: {
          callbacks: {
            label: (c) => `${c.dataset.label}: ${fmtNumber(c.parsed.y)} kWh/년`
          }
        }
      }
    }
  });
}

function fillSummary(j) {
  const ul = document.getElementById('summary-list');
  const items = [
    `연간 비용 절감 약 ${fmtCurrency(j.kpi?.savingCostYr)} 수준`,
    `예상 절감량 ${fmtNumber(j.kpi?.savingKwhYr)} kWh/년`,
    `예상 절감률 ${fmtPercent(deriveSavingPct(j))}`,
    `투자 회수 기간 약 ${j.kpi?.paybackYears ?? '-'} 년`
  ];
  ul.innerHTML = items.map((t) => `<li>${t}</li>`).join('');
}

/* ====== Hero Video ====== */
function bootHeroVideo() {
  const v = document.getElementById('hero-video');
  if (!v) return;
  v.addEventListener('canplay', () => { try { v.play().catch(() => {}); } catch (_) {} }, { once: true });
  const io = new IntersectionObserver(([e]) => {
    if (!v) return;
    if (e.isIntersecting) v.play().catch(() => {});
    else v.pause();
  }, { threshold: 0.2 });
  io.observe(v);
}

/* ====== utils ====== */
function tinyDelay() { return new Promise((r) => setTimeout(r, 160)); }
function range(f, t) { const a = []; for (let y = f; y <= t; y++) a.push(y); return a; }
function firstPositiveIndex(arr) { for (let i = 0; i < (arr?.length || 0); i++) if (arr[i] > 0) return i; return -1; }
function setText(sel, txt) { const el = document.querySelector(sel); if (el) el.textContent = txt; }
function fmtNumber(n) { if (n == null) return '-'; return new Intl.NumberFormat('ko-KR').format(n); }
function fmtCurrency(n) { if (n == null) return '-'; return new Intl.NumberFormat('ko-KR').format(n) + ' 원'; }
function fmtPercent(p) { if (p == null) return '-'; return new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 1 }).format(p) + '%'; }
function deriveSavingPct(j) {
  const before = j.series?.before ?? [];
  const saving = j.series?.saving ?? [];
  if (!before.length || !saving.length) return null;
  let sum = 0, cnt = 0;
  for (let i = 0; i < Math.min(before.length, saving.length); i++) {
    if (before[i]) { sum += (saving[i] / before[i]) * 100; cnt++; }
  }
  return cnt ? (sum / cnt) : null;
}
