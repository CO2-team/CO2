document.addEventListener('DOMContentLoaded', init);

/* ========= Loader 설정 ========= */
let _loaderTimer = null;   // 진행률 인터벌 핸들
let _cap = 20;             // 진행 상한 (20 → 40 → 60 → 80 → 100)
const TICK_MS = 200;       // 게이지 증가 주기(0.2s)
const STEP_MIN = 1;        // 1틱 최소 증가폭(%)
const STEP_MAX = 3;        // 1틱 최대 증가폭(%)
const STEP_PAUSE_MS = [3000, 3000, 3000, 3000]; // 5단계 사이 멈춤 연출
const CLOSE_DELAY_MS = 4000; // 100% 찍은 후 패널 닫기까지 대기

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
  const timelineP = runFiveStepTimeline(); // 5단계 타임라인(멈춤→상한 해제) 병행

  try {
    // 1) API 호출
    const res = await fetch(`/api/buildings/${buildingId}/forecast?from=2024&to=2026`);
    if (!res.ok) throw new Error(`API ${res.status}`);
    const j = await res.json();

    // 2) 렌더링
    applyBanner(j);
    fillKpis(j);
    drawComboChart(j);   // ✅ 막대=비용 절감(원/년, 우측축) + 선=에너지 After(kWh/년, 좌측축)
    fillSummary(j);

    // 3) 타임라인 종료 대기 → 100% → 닫기
    await timelineP;
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

    // 4 → 5 단계
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
    // 상한 도달 시 멈춰 보임 (_cap이 다음 단계로 해제되면 다시 증가)
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

  // 절감률은 BE에서 내려준 값을 그대로 사용 (before 제거 대응)
  const pct = j.kpi?.savingPct;
  setText('#kpi-saving-pct', pct != null ? fmtPercent(pct) : '-');

  setText('#kpi-payback', j.kpi?.paybackYears ?? '-');
}

/* 혼합 차트(한 장):
   - Line: 비용 절감 (원/년) → 우측 Y축 (yCost)
   - Bar: 에너지 사용량 (kWh/년) → 좌측 Y축 (yEnergy)
   - 애니메이션:
     · 막대: 아래→위 상승 + 인덱스 순서 지연
     · 선: 좌→우로 점 순차 등장(지연) + 선 연결
*/
function drawComboChart(j) {
  const years    = range(j.meta?.fromYear ?? 2024, j.meta?.toYear ?? 2026);
  const energy   = j.series?.after  ?? [];   // 에너지 사용량 (kWh/년) — 막대
  const costSave = j.cost?.saving   ?? [];   // 비용 절감 (원/년) — 꺾은선

  const ctx = document.getElementById('chart-energy-combo').getContext('2d');
  new Chart(ctx, {
    data: {
      labels: years,
      datasets: [
        // ── Bar: 에너지 사용량(kWh/년) ──
        {
          type: 'bar',
          label: '에너지 사용량 (kWh/년)',   // ✅ 라벨 교체
          data: energy,
          yAxisID: 'yEnergy',
          borderRadius: 6
        },
        // ── Line: 비용 절감(원/년) ──
        {
          type: 'line',
          label: '비용 절감 (원/년)',
          data: costSave,
          yAxisID: 'yCost',
          fill: false,
          tension: 0.3,
          borderWidth: 2,
          pointRadius: 3
        }
      ]
    },
    options: {
      responsive: true,
      animation: { duration: 900, easing: 'easeOutQuart' },
      scales: {
        // 좌측: kWh
        yEnergy: {
          position: 'left',
          beginAtZero: true,
          title: { display: true, text: 'kWh/년' },
          ticks: { callback: (v) => fmtNumber(v) }
        },
        // 우측: 원
        yCost: {
          position: 'right',
          beginAtZero: true,
          grid: { drawOnChartArea: false },
          title: { display: true, text: '원/년' },
          ticks: { callback: (v) => fmtNumber(v) }
        }
      },
      plugins: {
        tooltip: {
          callbacks: {
            label: (c) => {
              const isCost = c.dataset.yAxisID === 'yCost';
              const val = c.parsed.y;
              return isCost
                ? `${c.dataset.label}: ${fmtCurrency(val).replace(' 원','원/년')}`
                : `${c.dataset.label}: ${fmtNumber(val)} kWh/년`;
            }
          }
        },
        legend: { labels: { boxWidth: 14, boxHeight: 14 } }
      }
    }
  });
}


function fillSummary(j) {
  const ul = document.getElementById('summary-list');
  const items = [
    `연간 비용 절감 약 ${fmtCurrency(j.kpi?.savingCostYr)} 수준`,
    `예상 절감량 ${fmtNumber(j.kpi?.savingKwhYr)} kWh/년`,
    `예상 절감률 ${fmtPercent(j.kpi?.savingPct)}`,
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
function setText(sel, txt) { const el = document.querySelector(sel); if (el) el.textContent = txt; }
function fmtNumber(n) { if (n == null) return '-'; return new Intl.NumberFormat('ko-KR').format(n); }
function fmtCurrency(n) { if (n == null) return '-'; return new Intl.NumberFormat('ko-KR').format(n) + ' 원'; }
function fmtPercent(p) { if (p == null) return '-'; return new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 1 }).format(p) + '%'; }
