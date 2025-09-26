/* =========================
 * forecast.js (FULL, fixed)
 * - DOMContentLoaded → init() 실행
 * - 헤더 겹침 보정(스크롤/리사이즈/드롭다운 대응)
 * - 5단계 로딩바(최소 표시시간 지원)
 * - API 연동(건물 ID 유/무 모두 지원)
 * - KPI/배너/요약 렌더
 * - 차트: 막대 순차 → 점 순차 → 선 표시
 * ========================= */

document.addEventListener('DOMContentLoaded', () => {
  init().catch(err => console.error('[forecast] init failed:', err));
});

/* ---------- 피그마 고정 텍스트 ---------- */
const BANNER_TEXTS = {
  recommend: '연식과 향후 비용 리스크를 고려할 때, 리모델링을 권장합니다.',
  conditional: '일부 항목은 적정하나, 향후 효율과 수익성 검토가 필요합니다.',
  'not-recommend': '현재 조건에서 리모델링 효과가 제한적입니다.'
};

/* ---------- Header offset (scroll/resize/dropdown 대응) ---------- */
function applyHeaderOffset() {
  const menubar = document.getElementById('menubar');
  const spacer  = document.querySelector('.header-spacer');
  const wrap    = document.querySelector('main.wrap');
  if (!wrap || !spacer) return;

  let overlay = false;
  let h = 0;

  if (menubar) {
    const cs   = getComputedStyle(menubar);
    const rect = menubar.getBoundingClientRect();
    const isFixed     = cs.position === 'fixed';
    const isStickyNow = cs.position === 'sticky' && rect.top <= 0;
    overlay = isFixed || isStickyNow;
    h = rect.height;
  }

  document.documentElement.style.setProperty('--header-h', h + 'px');
  wrap.style.paddingTop = overlay ? (h + 'px') : '0px';
  spacer.style.height = '0px'; // 이중 여백 방지
}

function initHeaderOffset() {
  applyHeaderOffset();

  // rAF 스로틀 기반 스크롤 핸들러
  let ticking = false;
  const onScrollTick = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => { applyHeaderOffset(); ticking = false; });
  };

  window.addEventListener('resize', applyHeaderOffset);
  window.addEventListener('orientationchange', applyHeaderOffset);
  window.addEventListener('scroll', onScrollTick, { passive: true });

  const wrap = document.querySelector('main.wrap');
  if (wrap) wrap.addEventListener('scroll', onScrollTick, { passive: true });

  const menubar = document.getElementById('menubar');
  if (window.ResizeObserver && menubar) {
    const ro = new ResizeObserver(applyHeaderOffset);
    ro.observe(menubar);
  }
}

/* ---------- 초기화 ---------- */
async function init() {
  initHeaderOffset();

  const root = document.getElementById('forecast-root');
  const bid  = root?.dataset.bid || '';
  const from = Number(root?.dataset.from || '2024');
  const to   = Number(root?.dataset.to   || '2030');

  const $result = $('#result-section');
  const $ml     = $('#mlLoader');

  // 게이트: 결과 숨기고 로더 시작
  show($ml); hide($result);
  startLoader();

  // 데이터 로드
  const data = await fetchForecast(bid, from, to);
  window.FORECAST_DATA = data; // 디버깅 용

  /* ✅ 추가: ID가 없으면 라벨/데이터 길이를 from~to로 강제 */
  if (!bid || bid === 'default') {
    const expectedYears = makeYearsArray(from, to);     // ['2024', ... '2030']
    const L = expectedYears.length;

    data.years = expectedYears;
    data.series = data.series || {};
    data.cost   = data.cost   || {};

    data.series.after  = fillTo(L, data.series.after, 0);
    data.series.saving = fillTo(L, data.series.saving, 0);
    data.cost.saving   = fillTo(L, data.cost.saving, 0);
  }

  // KPI 계산 (API 제공값 우선)
  const kpi = computeKpis({
    years: data.years,
    series: data.series,
    cost: data.cost,
    kpiFromApi: data.kpi
  });

  // 등급/배너/요약
  const gradeNow = estimateEnergyGrade(kpi.savingPct);
  const status   = decideStatusByKpi(kpi);
  applyStatus(status);
  renderKpis(kpi, { gradeNow });
  renderSummary({ gradeNow, kpi });

  // 로더 최소 표시시간 보장 후 종료
  await ensureMinLoaderTime();
  await finishLoader();

  // 결과 노출
  hide($ml); show($result);

  // 차트 렌더(단일 렌더)
  await renderEnergyComboChart({
    years: data.years,
    series: data.series,
    cost: data.cost
  });
}

/* ---------- ML Loader ---------- */
const LOADER = {
  timer: null,
  TICK_MS: 200,
  STEP_MIN: 1,
  STEP_MAX: 3,
  STEP_PAUSE_MS: [3000, 3000, 3000, 3000], // 단계 사이 멈춤
  MIN_VISIBLE_MS: 16000,   // 데모용: 최소 4초(운영 시 10~16초로 조정)
  cap: 20,                // 20 → 40 → 60 → 80 → 100
  CLOSE_DELAY_MS: 4000,    // 완료 후 닫힘까지 지연
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

  if (!$bar || steps.length < 5 || !$text) {
    console.warn('[loader] required elements missing');
  }

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
    if ($text)  $text.textContent = labels[level] || '진행 중';

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
    if (bar) {
      bar.style.width = '100%';
      bar.setAttribute('aria-valuenow', '100');
    }
    $all('.progress-map .step').forEach((el) => el.classList.add('done'));
    setTimeout(res, LOADER.CLOSE_DELAY_MS);
  });
}

/* ---------- Data ---------- */

/* ID 없을 때 사용할 더미 데이터 생성기 */
function makeDummyForecast(fromYear, toYear) {
  const years = [];
  for (let y = Number(fromYear); y <= Number(toYear); y++) {
    years.push(String(y));
  }

  // 시작값/감소폭은 네 프로젝트 기준으로 맞춰둠
  const baseKwh = 2_150_000;  // 시작 에너지 사용량(kWh/년)
  const stepKwh = 20_000;     // 해마다 감소
  const startSaving = 300_000;
  const stepSaving  = 10_000;
  const UNIT_PRICE  = 120;    // 1kWh당 원(원/년)

  const after  = years.map((_, i) => baseKwh - i * stepKwh);
  const saving = years.map((_, i) => Math.max(startSaving - i * stepSaving, 0));
  const savingCost = saving.map(k => k * UNIT_PRICE);

  return { years, series: { after, saving }, cost: { saving: savingCost }, kpi: null };
}

async function fetchForecast(buildingId, fromYear, toYear) {
  const years = range(fromYear, toYear);

  const hasId = Number.isFinite(Number(buildingId)) &&
                buildingId !== '' && buildingId !== 'default';

  /* ID가 없으면 API 호출하지 않고 즉시 더미 데이터 반환 */
  if (!hasId) {
    return makeDummyForecast(fromYear, toYear);
  }

  const url = `/api/forecast/${encodeURIComponent(buildingId)}?from=${fromYear}&to=${toYear}`;

  try {
    const rsp = await fetch(url, { headers: { 'Accept': 'application/json' } });
    if (!rsp.ok) throw new Error(rsp.status + '');
    const json = await rsp.json();
    return normalizeForecast(json, years);
  } catch (e) {
    console.error('[forecast] fetch failed, using fallback stub:', e);
    // 폴백(네가 쓰던 값 유지)
    const after      = [2150000, 2090000, 2070000, 2050000, 2030000, 2010000, 1990000];
    const saving     = [300000,  280000,  270000,  260000,  250000,  240000,  230000];
    const savingCost = [36000000,33600000,32400000,31200000,30000000,28800000,27600000];
    return { years, series: { after, saving }, cost: { saving: savingCost }, kpi: null };
  }
}

function normalizeForecast(d, fallbackYears) {
  const years  = Array.isArray(d?.years) ? d.years : fallbackYears;
  const after  = Array.isArray(d?.series?.after)  ? d.series.after  : new Array(years.length).fill(0);
  const saving = Array.isArray(d?.series?.saving) ? d.series.saving : new Array(years.length).fill(0);
  const cost   = d?.cost ?? { saving: new Array(years.length).fill(0) };
  const kpi    = d?.kpi ?? null;
  return { years, series: { after, saving }, cost, kpi };
}

/* ---------- KPI / 상태 / 출력 ---------- */
function computeKpis({ years, series, cost, kpiFromApi }) {
  // 서버가 KPI를 주면 그걸 우선 사용
  if (kpiFromApi && isFinite(kpiFromApi.savingCostYr)) return kpiFromApi;

  // 마지막 연도 기준 대표값
  const i = Math.max(0, years.length - 1);
  const afterKwh   = +series.after[i] || 0;
  const savingKwh  = +series.saving[i] || 0;
  const savingCost = +((cost?.saving || [])[i]) || Math.round(savingKwh * 120);

  const beforeKwh  = afterKwh + savingKwh;
  const savingPct  = beforeKwh > 0 ? Math.round((savingKwh / beforeKwh) * 100) : 0;

  // 대략치: 절감이 클수록 회수기간 짧아지는 단순 모델(서버 KPI 없을 때만)
  const paybackYears = clamp((afterKwh / Math.max(1, savingKwh)) * 0.8, 3, 8);

  return { savingCostYr: savingCost, savingKwhYr: savingKwh, savingPct, paybackYears };
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

  classes.forEach((c) => { banner?.classList.remove(c); result?.classList.remove(c); });
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

/* 요약에 쓰는 라벨/계산 규칙 */
function euiRefForGrade(grade) {
  const map = { 1: 120, 2: 160, 3: 180, 4: 200, 5: 220 };
  return map[grade] ?? 180;
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

  // 템포(요청값)
  const BAR_GROW_MS  = 2000;
  const BAR_GAP_MS   = 500;
  const POINT_MS     = 600;
  const POINT_GAP_MS = 200;

  const labels  = years.map(String);
  const bars    = series.after.slice(0, labels.length);
  const costs   = (cost?.saving || []).slice(0, labels.length);
  const n       = labels.length;

  // 색상
  const BAR_BG      = 'rgba(54, 162, 235, 0.5)';
  const BAR_BORDER  = 'rgb(54, 162, 235)';
  const LINE_ORANGE = '#F57C00';

  // 베이스라인 픽셀(y=0)에서 시작
  function fromBaseline(ctx) {
    const chart  = ctx.chart;
    const ds     = chart.data.datasets[ctx.datasetIndex];
    const axisId = ds.yAxisID || (ds.type === 'line' ? 'yCost' : 'yEnergy');
    const scale  = chart.scales[axisId];
    return scale.getPixelForValue(0);
  }

  // 타이밍 계산
  const totalBarDuration   = n * (BAR_GROW_MS + BAR_GAP_MS);
  const pointStartAt       = totalBarDuration;
  const totalPointDuration = n * (POINT_MS + POINT_GAP_MS);
  const lineRevealAt       = pointStartAt + totalPointDuration;

  const lineDs = {
    type: 'line',
    label: '비용 절감',
    data: costs,
    yAxisID: 'yCost',
    tension: 0.3,
    spanGaps: false,
    fill: false,
    showLine: false,
    pointRadius: new Array(n).fill(0),
    borderColor: LINE_ORANGE,
    backgroundColor: LINE_ORANGE,
    pointBackgroundColor: LINE_ORANGE,
    pointBorderColor: LINE_ORANGE,
    animations: {
      y: {
        from: fromBaseline,
        duration: POINT_MS,
        delay: (ctx) => {
          if (ctx.type !== 'data' || ctx.mode !== 'default') return 0;
          return pointStartAt + ctx.dataIndex * (POINT_MS + POINT_GAP_MS);
        },
        easing: 'easeOutCubic'
      }
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
          backgroundColor: BAR_BG,
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
            label: (ctx) => {
              const isCost = ctx.dataset.yAxisID === 'yCost';
              const val = ctx.parsed.y;
              return `${ctx.dataset.label}: ${nf(val)} ${isCost ? '원/년' : 'kWh/년'}`;
            }
          }
        }
      },
      scales: {
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

  // 포인트 반경 0 → 3으로 순차 상승
  for (let i = 0; i < n; i++) {
    const delay = pointStartAt + i * (POINT_MS + POINT_GAP_MS);
    setTimeout(() => {
      lineDs.pointRadius[i] = 3;
      energyChart.update('none');
    }, delay);
  }

  // 모든 점 등장 후 선을 한 번에 보이기
  setTimeout(() => {
    energyChart.data.datasets[0].animations = false; // bar 재애니 방지
    lineDs.showLine = true;
    energyChart.update('none');
  }, lineRevealAt + 50);

  window.energyChart = energyChart; // 디버깅
}

/* ---------- Helpers ---------- */
function getBuildingId() {
  const root = document.getElementById('forecast-root');
  return root?.dataset?.bid ?? '';
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

function show(el){ if (el) el.classList.remove('hidden'); }
function hide(el){ if (el) el.classList.add('hidden'); }

/* == 안전 유틸: 라벨 강제 및 길이 맞추기 == */
function fillTo(len, arr, val = 0) {
  const a = Array.isArray(arr) ? arr.slice(0, len) : [];
  while (a.length < len) a.push(val);
  return a;
}
function makeYearsArray(from, to) {
  return range(from, to).map(String);
}