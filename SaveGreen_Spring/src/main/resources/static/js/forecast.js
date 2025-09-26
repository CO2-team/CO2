/* =========================
 * forecast.js  (FULL)
 * - 게이트: 로딩 끝나기 전 결과 숨김
 * - 5단계 로딩(각 단계 독립 진행) + 최소표시시간
 * - 단계 완료 시 .done 부여 → CSS가 동그라미 안에 ✓만 표시
 * - KPI/요약/배너: 피그마 문구/순서
 * - 차트: 로더 종료 후 최초 렌더 시작(빈 상태) → 막대 '완전 순차' → 점 순차 → 선 표시
 * ========================= */

document.addEventListener('DOMContentLoaded', init);

/* ---------- 피그마 고정 텍스트 ---------- */
const BANNER_TEXTS = {
  recommend: '연식과 향후 비용 리스크를 고려할 때, 리모델링을 권장합니다.',
  conditional: '일부 항목은 적정하나, 향후 효율과 수익성 검토가 필요합니다.',
  'not-recommend': '현재 조건에서 리모델링 효과가 제한적입니다.'
};

/* ---------- Header offset (scroll 대응) ---------- */
function applyHeaderOffset()
{
  const menubar = document.getElementById('menubar');
  const spacer  = document.querySelector('.header-spacer');
  const wrap    = document.querySelector('main.wrap');
  if (!wrap || !spacer) return;

  let overlay = false;
  let h = 0;

  if (menubar)
  {
    const cs   = getComputedStyle(menubar);
    const rect = menubar.getBoundingClientRect();

    const isFixed      = cs.position === 'fixed';
    // sticky인 경우, 실제로 화면 상단에 “붙어 있는 순간”만 오버레이로 간주
    const isStickyNow  = cs.position === 'sticky' && rect.top <= 0;

    overlay = isFixed || isStickyNow;
    h = rect.height;
  }

  // CSS 변수로 노출(필요 시 다른 요소에서 사용)
  document.documentElement.style.setProperty('--header-h', h + 'px');

  // 오버레이일 때만 상단 패딩 적용
  wrap.style.paddingTop = overlay ? (h + 'px') : '0px';

  // JS 동작 시 스페이서는 항상 0으로 (중복 여백 방지)
  spacer.style.height = '0px';
}

function initHeaderOffset()
{
  // 최초 1회
  applyHeaderOffset();

  // rAF로 스크롤 처리 스로틀링
  let ticking = false;
  const onScrollTick = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      applyHeaderOffset();
      ticking = false;
    });
  };

  // 창 리사이즈 / 회전
  window.addEventListener('resize', applyHeaderOffset);
  window.addEventListener('orientationchange', applyHeaderOffset);

  // 스크롤: window + 메인 컨테이너(overflow가 wrap에 걸린 경우 대비)
  window.addEventListener('scroll', onScrollTick, { passive: true });
  const wrap = document.querySelector('main.wrap');
  if (wrap) wrap.addEventListener('scroll', onScrollTick, { passive: true });

  // 드롭다운으로 헤더 높이가 변하는 경우 대응
  const menubar = document.getElementById('menubar');
  if (window.ResizeObserver && menubar)
  {
    const ro = new ResizeObserver(applyHeaderOffset);
    ro.observe(menubar);
  }
}


/* 요약에 쓰는 라벨/계산 규칙 */
function euiRefForGrade(grade) {
  const map = { 1: 120, 2: 160, 3: 180, 4: 200, 5: 220 };
  return map[grade] ?? 180;
}

/* ---------- 초기화 ---------- */
async function init() {
  // 헤더 높이 보정 먼저 적용
  initHeaderOffset();

  const $result = $('#result-section');
  const $ml = $('#mlLoader');

  // 0) 게이트: 결과 숨김
  if ($result) $result.classList.add('hidden');

  // 1) 로더 시작
  startLoader();

  // 2) 데이터 로드
  const buildingId = getBuildingId();
  const data = await fetchForecast(buildingId, 2024, 2030);
  const { years, series, cost } = data;

  // 3) KPI 계산 (API 우선)
  const kpi = computeKpis({ years, series, cost, kpiFromApi: data.kpi });

  // 4) 등급 추정(피그마 카드/요약용)
  const gradeNow = estimateEnergyGrade(kpi.savingPct);

  // 5) 상태 → 배너/아이콘배경
  const status = decideStatusByKpi(kpi);
  applyStatus(status);

  // 6) KPI 출력
  renderKpis(kpi, { gradeNow });

  // 7) 결과 요약(피그마 문구)
  renderSummary({ gradeNow, kpi });

  // 8) 최소 표시 시간 보장 → 로더 종료
  await ensureMinLoaderTime();
  await finishLoader();

  // 9) 결과 노출
  if ($ml) $ml.classList.add('hidden');
  if ($result) $result.classList.remove('hidden');

  // 10) 이제 차트를 처음부터 0에서 순차 애니메이션(단일 렌더, 재애니메이션 없음)
  await renderEnergyComboChart({ years, series, cost });
}

/* ---------- ML Loader ---------- */
const LOADER = {
  timer: null,
  TICK_MS: 200,
  STEP_MIN: 1,
  STEP_MAX: 3,
  STEP_PAUSE_MS: [3000, 3000, 3000, 3000],
  MIN_VISIBLE_MS: 16000,
  cap: 20,                 // 20→40→60→80→100
  CLOSE_DELAY_MS: 4000,
  startedAt: 0
};

function startLoader() {
  LOADER.startedAt = performance.now();

  const $bar   = $('#progressBar');
  const steps  = $all('.progress-map .step');
  const $text  = $('#mlStatusText');
  const labels = {
    1: '데이터 로딩',
    2: '정규화 / 스케일링',
    3: '모델 피팅',
    4: '예측 / 검증',
    5: '차트 렌더링'
  };

  let progress = 0;  // %
  let level    = 1;  // 1~5

  if ($text) $text.textContent = '초기화';
  LOADER.cap = 20;
  if (LOADER.timer) clearInterval(LOADER.timer);
  LOADER.timer = setInterval(tick, LOADER.TICK_MS);

  function tick() {
    if (!$bar) return;

    if (progress < LOADER.cap) {
      progress += rand(LOADER.STEP_MIN, LOADER.STEP_MAX);
      if (progress > LOADER.cap) progress = LOADER.cap;
      $bar.style.width = progress + '%';
      $bar.setAttribute('aria-valuenow', String(progress));
      return;
    }

    const stepEl = steps[level - 1];
    if (stepEl) stepEl.classList.add('done');
    if ($text) $text.textContent = labels[level] || '진행 중';

    if (level === 5) {
      clearInterval(LOADER.timer);
      return;
    }

    level += 1;
    LOADER.cap += 20;

    clearInterval(LOADER.timer);
    setTimeout(() => {
      LOADER.timer = setInterval(tick, LOADER.TICK_MS);
    }, LOADER.STEP_PAUSE_MS[level - 2] || 0);
  }
}

async function ensureMinLoaderTime() {
  const elapsed = performance.now() - LOADER.startedAt;
  const waitMs = Math.max(0, LOADER.MIN_VISIBLE_MS - elapsed);
  if (waitMs > 0) await sleep(waitMs);
}

function finishLoader() {
  return new Promise((res) => {
    clearInterval(LOADER.timer);
    const bar = $('#progressBar');
    if (bar) bar.style.width = '100%';
    $all('.progress-map .step').forEach((el) => el.classList.add('done'));
    setTimeout(res, LOADER.CLOSE_DELAY_MS);
  });
}

/* ---------- Data ---------- */
async function fetchForecast(buildingId, fromYear, toYear) {
  const years = range(fromYear, toYear);
    // 예: 2024~2030 예측
    const url = `/api/forecast/${encodeURIComponent(buildingId)}?from=${fromYear}&to=${toYear}`;


  try {
    const rsp = await fetch(url, { headers: { 'Accept': 'application/json' } });
    if (!rsp.ok) throw new Error(rsp.status);
    const json = await rsp.json();
    return normalizeForecast(json, years);
  } catch (e) {
    // 폴백(데모 데이터)
    const after = [2150000, 2090000, 2070000, 2050000, 2030000, 2010000, 1990000];
    const saving = [300000, 280000, 270000, 260000, 250000, 240000, 230000];
    const savingCost = [36000000, 33600000, 32400000, 31200000, 30000000, 28800000, 27600000];
    return { years, series: { after, saving }, cost: { saving: savingCost }, kpi: null };
  }
}

function normalizeForecast(d, fallbackYears) {
  const years  = Array.isArray(d?.years) ? d.years : fallbackYears;
  const after  = d?.series?.after ?? [];
  const saving = d?.series?.saving ?? [];
  const cost   = d?.cost ?? {};
  const kpi    = d?.kpi ?? null;
  return { years, series: { after, saving }, cost, kpi };
}

/* ---------- KPI / 상태 / 출력 ---------- */
function computeKpis({ years, series, cost, kpiFromApi }) {
  if (kpiFromApi && isFinite(kpiFromApi.savingCostYr)) return kpiFromApi;

  const i = years.length - 1;
  const afterKwh  = +series.after[i] || 0;
  const savingKwh = +series.saving[i] || 0;
  const savingCostYr = +((cost?.saving || [])[i]) || Math.round(savingKwh * 120);

  const beforeKwh = afterKwh + savingKwh;
  const savingPct = beforeKwh > 0 ? Math.round((savingKwh / beforeKwh) * 100) : 0;

  const paybackYears = clamp((afterKwh / Math.max(1, savingKwh)) * 0.8, 3, 8);

  return { savingCostYr, savingKwhYr: savingKwh, savingPct, paybackYears };
}

function estimateEnergyGrade(savingPct) {
  if (savingPct >= 30) return 1;
  if (savingPct >= 20) return 2;
  if (savingPct >= 10) return 3;
  return 4;
}

function decideStatusByKpi(kpi) {
  if (kpi.savingPct >= 15 && kpi.paybackYears <= 5) return 'recommend';
  if (kpi.paybackYears <= 8) return 'conditional';
  return 'not-recommend';
}

function applyStatus(status) {
  const banner = $('#status-banner');
  const result = $('#result-section');
  const classes = ['recommend', 'conditional', 'not-recommend'];

  classes.forEach((c) => {
    banner?.classList.remove(c);
    result?.classList.remove(c);
  });
  if (classes.includes(status)) {
    banner?.classList.add(status);
    result?.classList.add(status);
  }

  const msg = $('#banner-message');
  const badge = $('#banner-badge');
  if (msg)   msg.textContent = BANNER_TEXTS[status] || '';
  if (badge) badge.textContent =
    status === 'recommend' ? '추천' :
    status === 'conditional' ? '조건부' : '비추천';
}

function applyHeaderOffset()
{
  const menubar = document.getElementById('menubar');
  const spacer  = document.querySelector('.header-spacer');
  const wrap    = document.querySelector('main.wrap');
  if (!wrap || !spacer) return;

  // 헤더가 정말로 “겹쳐올리는지” 판별
  // - position: fixed 이면 무조건 오버레이
  // - position: sticky 이고 top <= 0 이면 화면 상단에 달라붙어 오버레이
  let overlay = false;
  if (menubar)
  {
    const cs  = getComputedStyle(menubar);
    const pos = cs.position;
    const top = parseFloat(cs.top) || 0;
    overlay = (pos === 'fixed') || (pos === 'sticky' && top <= 0);
  }

  const h = menubar ? menubar.getBoundingClientRect().height : 0;

  // CSS 변수로 노출(필요시 다른 곳에서 사용)
  document.documentElement.style.setProperty('--header-h', h + 'px');

  // 오버레이일 때만 패딩 적용, 아니면 0
  wrap.style.paddingTop = overlay ? (h + 'px') : '0px';

  // JS 동작 시 스페이서는 항상 0으로 (중복 여백 방지)
  spacer.style.height = '0px';
}

function initHeaderOffset()
{
  applyHeaderOffset();
  window.addEventListener('resize', applyHeaderOffset);

  const menubar = document.getElementById('menubar');
  if (window.ResizeObserver && menubar)
  {
    const ro = new ResizeObserver(applyHeaderOffset);
    ro.observe(menubar);
  }
}


function renderKpis(kpi, { gradeNow }) {
  const g  = $('#kpi-grade');
  const sc = $('#kpi-saving-cost');
  const pb = $('#kpi-payback');
  const sp = $('#kpi-saving-pct');

  if (g)  g.textContent  = String(gradeNow);
  if (sc) sc.textContent = nf(kpi.savingCostYr);
  if (pb) pb.textContent = (Math.round(kpi.paybackYears * 10) / 10).toFixed(1);
  if (sp) sp.textContent = kpi.savingPct + '%';
}

/* 결과 요약(피그마 문구) */
function renderSummary({ gradeNow, kpi }) {
  const ul = $('#summary-list');
  if (!ul) return;
  ul.innerHTML = '';

  const targetGrade   = Math.max(1, gradeNow - 1); // +1등급 목표
  const currentEui    = euiRefForGrade(gradeNow);
  const boundaryEui   = euiRefForGrade(targetGrade);
  const needSavingPct = Math.max(0, Math.round(((currentEui - boundaryEui) / currentEui) * 100));

  [
    `현재 등급 : <strong>${gradeNow}등급(EUI ${currentEui} kWh/m^2/년)</strong>`,
    `목표 : <strong>+1등급(${targetGrade}등급)</strong>`,
    `등급 상승 기준(EUI 경계값) : <strong>${boundaryEui} kWh/m^2/년</strong>`,
    `등급 상승 필요 절감률 : <strong>${needSavingPct}%</strong>`
  ].forEach((html) => {
    const li = document.createElement('li');
    li.innerHTML = html;
    ul.appendChild(li);
  });
}

/* ---------- Chart.js ---------- */
let energyChart = null;

async function renderEnergyComboChart({ years, series, cost }) {
  if (typeof Chart === 'undefined') { console.warn('Chart.js not loaded'); return; }

  const canvas = document.getElementById('chart-energy-combo');
  if (!canvas) { console.warn('#chart-energy-combo not found'); return; }

  // 기존 차트 제거
  if (Chart.getChart) {
    const existed = Chart.getChart(canvas);
    if (existed) existed.destroy();
  }
  if (energyChart) energyChart.destroy();

  const ctx = canvas.getContext('2d');

  /* ===== 템포(요청값) ===== */
  const BAR_GROW_MS  = 2000;  // 막대 하나 자라는 시간
  const BAR_GAP_MS   = 500;   // 막대 간 간격
  const POINT_MS     = 600;   // 점 하나 등장 시간
  const POINT_GAP_MS = 200;   // 점 간 간격

  const labels  = years.map(String);
  const bars    = series.after.slice(0, labels.length);
  const costs   = (cost?.saving || []).slice(0, labels.length);
  const n       = labels.length;

  /* ===== 색상 ===== */
  // 막대: Chart.js 기본 파랑
  const BAR_BG      = 'rgba(54, 162, 235, 0.5)';
  const BAR_BORDER  = 'rgb(54, 162, 235)';
  // 꺾은선/점: 주황
  const LINE_ORANGE = '#F57C00';

  // 베이스라인에서 시작 (0 → 값)
  function fromBaseline(ctx) {
    const chart  = ctx.chart;
    const ds     = chart.data.datasets[ctx.datasetIndex];
    const axisId = ds.yAxisID || (ds.type === 'line' ? 'yCost' : 'yEnergy');
    const scale  = chart.scales[axisId];
    return scale.getPixelForValue(0);
  }

  // 타이밍 계산: 막대 끝난 다음에 점/선
  const totalBarDuration   = n * (BAR_GROW_MS + BAR_GAP_MS);
  const pointStartAt       = totalBarDuration; // 막대 모두 끝난 뒤 포인트 시작
  const totalPointDuration = n * (POINT_MS + POINT_GAP_MS);
  const lineRevealAt       = pointStartAt + totalPointDuration; // 모든 점 등장 후 선 표시

  // 꺾은선: 선은 나중에 켜고, 점은 반경 0에서 시작(타이밍에 3으로 올림)
  const lineDs = {
    type: 'line',
    label: '비용 절감',
    data: costs,                       // 값은 미리 넣음 (y 애니는 delay로 제어)
    yAxisID: 'yCost',
    tension: 0.3,
    spanGaps: false,
    fill: false,
    showLine: false,                   // 마지막에 한 번에 선 보이기
    pointRadius: new Array(n).fill(0), // 처음엔 점 숨김(반경 0)
    borderColor: LINE_ORANGE,
    backgroundColor: LINE_ORANGE,
    pointBackgroundColor: LINE_ORANGE,
    pointBorderColor: LINE_ORANGE,
    animations: {
      // 점의 y 위치만 "막대 이후" 순차로 0→값
      y: {
        from: fromBaseline,
        duration: POINT_MS,
        delay: (ctx) => {
          if (ctx.type !== 'data' || ctx.mode !== 'default') return 0;
          return pointStartAt + ctx.dataIndex * (POINT_MS + POINT_GAP_MS);
        },
        easing: 'easeOutCubic'
      }
      // radius 애니는 사용 안 함 → 반경은 아래 setTimeout으로 제어
    }
  };

  energyChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          type: 'bar',
          label: '에너지 사용량',
          data: bars,
          yAxisID: 'yEnergy',
          backgroundColor: BAR_BG,     // 파란 막대(원래 파랑)
          borderColor: BAR_BORDER,
          borderWidth: 1,
          animations: {
            x: { duration: 0 },
            y: {
              from: fromBaseline,
              duration: BAR_GROW_MS,
              delay: (ctx) => {
                if (ctx.type !== 'data' || ctx.mode !== 'default') return 0;
                return ctx.dataIndex * (BAR_GROW_MS + BAR_GAP_MS);
              },
              easing: 'easeOutCubic'
            }
          }
        },
        lineDs
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: true },
        tooltip: {
          callbacks: {
            // 툴팁엔 단위 표기
            label: (ctx) => {
              const isCost = ctx.dataset.yAxisID === 'yCost';
              const val = ctx.parsed.y;
              return `${ctx.dataset.label}: ${nf(val)} ${isCost ? '원/년' : 'kWh/년'}`;
            }
          }
        }
      },
      scales: {
        // ✅ 눈금엔 숫자만, 단위는 제목에만 한 번
        yEnergy: {
          type: 'linear',
          position: 'left',
          ticks: { callback: (v) => nf(v) },
          title: { display: true, text: '에너지 사용량 (kWh/년)' }
        },
        yCost: {
          type: 'linear',
          position: 'right',
          grid: { drawOnChartArea: false },
          ticks: { callback: (v) => nf(v) },
          title: { display: true, text: '비용 절감 (원/년)' }
        },
        x: { title: { display: false } }
      }
    }
  });

  // === 점(포인트) 반경을 타이밍에 맞춰 0 → 3으로 올리기 ===
  for (let i = 0; i < n; i++) {
    const delay = pointStartAt + i * (POINT_MS + POINT_GAP_MS);
    setTimeout(() => {
      lineDs.pointRadius[i] = 3;   // 점 보이기
      energyChart.update('none');  // 재애니메이션 없이 즉시 반영
    }, delay);
  }

  // === 모든 점 등장 후, 선(stroke) 한 번에 보이기 ===
  setTimeout(() => {
    energyChart.data.datasets[0].animations = false; // bar 재애니 방지
    lineDs.showLine = true;
    energyChart.update('none');
  }, lineRevealAt + 50);

  // 디버깅용
  window.energyChart = energyChart;
}






/* ---------- Helpers ---------- */
function getBuildingId() {
  const el = $('#page-data');
  return el?.dataset?.buildingId || 'default';
}

function nf(n) {
  try { return new Intl.NumberFormat('ko-KR').format(Math.round(Number(n) || 0)); }
  catch { return String(n); }
}

function range(a, b) {
  const arr = [];
  for (let y = a; y <= b; y++) arr.push(y);
  return arr;
}

function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function $(s, root = document) {
  return root.querySelector(s);
}

function $all(s, root = document) {
  return Array.from(root.querySelectorAll(s));
}
