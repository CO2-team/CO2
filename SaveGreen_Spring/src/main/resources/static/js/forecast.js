document.addEventListener('DOMContentLoaded', init);

/* ========= Loader 설정 ========= */
let _loaderTimer = null;   // 진행률 인터벌 핸들
let _cap = 20;             // 진행 상한 (20 → 40 → 60 → 80 → 100)
const TICK_MS = 200;       // 게이지 증가 주기(부드럽게 보이도록 0.2s)
const STEP_MIN = 1;        // 1틱 최소 증가폭(%)
const STEP_MAX = 3;        // 1틱 최대 증가폭(%)
const STEP_PAUSE_MS = [2000, 2000, 2000, 2000]; // 5단계 사이 멈춤 연출(총 8초)
const CLOSE_DELAY_MS = 2000; // 100% 찍은 후 패널 닫기까지 대기

// 단계별 상태 문구 (체크 5개에 매핑)
const STEP_STATUS = [
  '데이터 로딩',
  '정규화/스케일링',
  '모델 피팅 확인',
  '예측 생성 & 검증',
  '차트 렌더링'
];

async function init() {
  const buildingId = document.getElementById('page-data')?.dataset?.buildingId || '1';

  // 0) ML 패널 시작
  showPanel(true);
  setModel('선형 회귀(Linear Regression)');
  setStatus(STEP_STATUS[0]); // 1단계 문구
  _cap = 20;
  startLoaderProgress();                 // 게이지는 항상 현재 _cap까지 부드럽게 증가
  const timelineP = runFiveStepTimeline(); // 5단계 타임라인(멈춤→상한 해제)을 병행 실행

  try {
    // 1) API 호출
    const res = await fetch(`/api/buildings/${buildingId}/forecast?from=2024&to=2026`);
    if (!res.ok) throw new Error(`API ${res.status}`);
    const j = await res.json();

    // 2) 렌더링
    applyBanner(j);
    fillKpis(j);
    drawComboChart(j);
    fillSummary(j);

    // 3) 타임라인이 끝날 때까지 대기 → 100% → 닫기
    await timelineP;                // 5단계(80%)까지 끝나면 100% 단계로 진입
    completeLoaderProgress();       // 100%
    setTimeout(() => {
      showPanel(false);             // 패널 닫기
      document.getElementById('result-section').classList.remove('hidden');
    }, CLOSE_DELAY_MS);
  } catch (e) {
    console.error(e);
    // 실패 시에도 로더는 정상 종료 흐름 유지
    await timelineP.catch(()=>{});
    completeLoaderProgress();
    setTimeout(() => {
      showPanel(false);
      const b = document.getElementById('status-banner');
      b.className = 'banner not-recommend';
      document.getElementById('banner-message').textContent = '데이터를 불러오지 못했습니다.';
      document.getElementById('banner-badge').textContent = '비추천';
      document.getElementById('result-section').classList.remove('hidden');
    }, CLOSE_DELAY_MS);
  }

  // 히어로 비디오 가시성 제어
  bootHeroVideo();
}

/* ====== 5단계 타임라인 ======
   체크 5개와 정확히 매칭: 20% / 40% / 60% / 80% / 100%
   각 단계 사이를 STEP_PAUSE_MS로 '멈춤' 연출
*/
function runFiveStepTimeline() {
  return new Promise(async (resolve) => {
    // 1 → 2 단계
    await delay(STEP_PAUSE_MS[0]);
    _cap = 40; setStatus(STEP_STATUS[1]);

    // 2 → 3 단계
    await delay(STEP_PAUSE_MS[1]);
    _cap = 60; setStatus(STEP_STATUS[2]);

    // 3 → 4 단계
    await delay(STEP_PAUSE_MS[2]);
    _cap = 80; setStatus(STEP_STATUS[3]);

    // 4 → 5 단계(여기서는 상한을 100으로 올리기 직전에 잠깐 멈춤 느낌)
    await delay(STEP_PAUSE_MS[3]);
    _cap = 100; setStatus(STEP_STATUS[4]); // 최종 단계 문구
    resolve();
  });
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

/* 진행률 표시 + 체크 점등 (진행률 기반) */
function setProgress(p) {
  const clamped = Math.max(0, Math.min(100, p));
  const bar = document.getElementById('progressBar');
  if (bar) {
    bar.style.width = clamped + '%';
    bar.setAttribute('aria-valuenow', clamped);
  }
  // 체크 점등: 0~20~40~60~80~100 기준
  const steps = document.querySelectorAll('.check');
  const activeIdx = Math.min(steps.length, Math.ceil(clamped / 20));
  steps.forEach((el, i) => {
    el.textContent = (i < activeIdx) ? '✓' : '•';
    el.style.background = (i < activeIdx)
      ? 'rgba(34,211,238,.22)'
      : 'rgba(34,211,238,.12)';
  });
}

/* 상한(_cap)까지 부드럽게 증가시키는 루프 */
function startLoaderProgress() {
  setProgress(0);
  stopLoaderProgress();
  _loaderTimer = setInterval(() => {
    const now = parseInt(document.getElementById('progressBar')?.getAttribute('aria-valuenow') || '0', 10);
    // 현재 상한(_cap)까지는 랜덤 step으로 부드럽게 증가
    const step = STEP_MIN + Math.floor(Math.random() * (STEP_MAX - STEP_MIN + 1));
    const next = Math.min(_cap, now + step);
    setProgress(next);
    // 상한 도달 시에는 멈춰 보임 (상한이 다음 단계로 해제되면 다시 증가)
  }, TICK_MS);
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
  const after  = j.series?.after  ?? [];
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
function delay(ms) { return new Promise((r) => setTimeout(r, ms)); }
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
