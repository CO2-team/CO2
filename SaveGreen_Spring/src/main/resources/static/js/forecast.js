/* =========================
 * forecast.js (FULL, final)
 * - DOMContentLoaded → init()
 * - 헤더 겹침 보정
 * - 5단계 로딩바(최소 표시시간)
 * - API/더미 데이터 (from=to → 7년 확장)
 * - KPI/배너/요약 렌더
 * - 차트: 막대 순차 → 점 순차 → 선 표시 (항상 막대 위)
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

/* ---------- Header offset ---------- */
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
	spacer.style.height = '0px';
}

function initHeaderOffset() {
	applyHeaderOffset();
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

	// from/to 안전 계산: 같으면 7년 확장
	const rawFrom = root?.dataset.from ?? '2024';
	const rawTo   = root?.dataset.to   ?? '2030';
	let from = parseInt(String(rawFrom).trim(), 10);
	let to   = parseInt(String(rawTo).trim(), 10);
	if (!Number.isFinite(from)) from = 2024;
	if (!Number.isFinite(to))   to   = 2030;
	if (to < from) [from, to] = [to, from];
	if (to === from) to = from + 6;

	const bid  = String(root?.dataset.bid ?? '').trim();

	const $result = $('#result-section');
	const $ml     = $('#mlLoader');

	// 게이트: 결과 숨기고 로더 시작
	show($ml); hide($result);
	startLoader();

	// 데이터 로드
	const data = await fetchForecast(bid, from, to);
	window.FORECAST_DATA = data;

	// 길이/타입 강제 정렬
	{
		const expectedYears = range(from, to).map(String);
		const L = expectedYears.length;

		data.years  = expectedYears;
		data.series = data.series || {};
		data.cost   = data.cost   || {};

		const toNumArr = (arr, len) =>
			Array.from({ length: len }, (_, i) => {
				const v = (Array.isArray(arr) ? arr[i] : undefined);
				const n = Number(v);
				return Number.isFinite(n) ? n : 0;
			});

		data.series.after  = toNumArr(data.series.after,  L);
		data.series.saving = toNumArr(data.series.saving, L);
		data.cost.saving   = toNumArr(data.cost.saving,   L);
	}

	console.debug('[forecast] aligned lengths',
		{ years: data.years.length, after: data.series.after.length,
			saving: data.series.saving.length, costSaving: data.cost.saving.length,
			from, to, bid });

	// KPI & 출력
	const kpi = computeKpis({
		years: data.years,
		series: data.series,
		cost: data.cost,
		kpiFromApi: data.kpi
	});

	const gradeNow = estimateEnergyGrade(kpi.savingPct);
	const builtYear = Number(document.getElementById('forecast-root')?.dataset.builtYear);
	const statusObj = decideStatusByScore(kpi, { builtYear });

	console.debug('[forecast] status', statusObj);
	applyStatus(statusObj.label);
	window._STATUS_SCORE_ = statusObj.score;
	window.__STATUS__ = statusObj;

	renderKpis(kpi, { gradeNow });
	renderSummary({ gradeNow, kpi });

	await ensureMinLoaderTime();
	await finishLoader();

	hide($ml); show($result);

	await renderEnergyComboChart({
		years: data.years,
		series: data.series,
		cost: data.cost
	});
}

/* reloadForecast: builtYear 변경 후 결과만 다시 불러와 렌더 */
async function reloadForecast() {
	const root = document.getElementById('forecast-root');
	if (!root) return;

	// from / to 재계산(init와 동일)
	const rawFrom = root?.dataset.from ?? '2024';
	const rawTo = root?.dataset.to ?? '2030';
	let from = parseInt(String(rawFrom).trim(), 10);
	let to = parseInt(String(rawTo).trim(), 10);
	if (!Number.isFinite(from)) from = 2024;
	if (!Number.isFinite(to)) to = 2030;
	if (to < from) [from, to] = [to, from];
	if (to === from) to = from + 6;

	const bid = String(root?.dataset.bid ?? '').trim();

	const $result = $('#result-section');
	const $ml = $('mlLoader');

	// 로더 표시
	show($ml);
	hide($result);
	startLoader();

	// 데이터 로드
	const data = await fetchForecast(bid, from, to);
	window.FORECAST_DATA = data;

	// 길이/타입 강제 정렬(init와 동일)
	{
		const expectedYears = range(from, to).map(String);
		const L = expectedYears.length;

		data.years = expectedYears;
		data.series = data.series || {};
		data.cost = data.cost || {};

		const toNumArr = (arr, len) =>
			Array.from({length: len}, (_, i) => {
				const v = (Array.isArray(arr) ? arr[i] : undefined);
				const n = Number(v);
				return Number.isFinite(n) ? n : 0;
			});

		data.series.after = toNumArr(data.series.after, L);
		data.series.saving = toNumArr(data.series.saving, L);
		sata.cost.saving = toNumArr(data.cost.saving, L);
	}

	// KPI / 판정 / 요약
	const kpi = computeKpis({
		years: data.years,
		series: data.series,
		cost: data.cost,
		kpiFromApi: data.kpi
	});

	const gradeNow = estimateEnergyGrade(kpi.savingPct);
	const builtYear = Number(document.getElementById('forecast-root')?.dataset.builtYear);
	const statusObj = decideStatusByScore(kpi, {builtYear});

	applyStatus(statusObj.label);
	window._STATUS_SCORE_ = statusObj.score;
	window.__STATUS__ = statusObj;

	renderKpis(kpi, {gradeNow});
	renderSummary({gradeNow, kpi});

	await ensureMinLoaderTime();
	await finishLoader();
	hide($ml);
	show($result);

	await renderEnergyComboChart({
		year: data.years,
		series: data.series,
		cost: data.cost
	});
}

/* ---------- ML Loader ---------- */
const LOADER = {
	timer: null,
	stepTimer: null,
	done: false,
	TICK_MS: 200,
	STEP_MIN: 1,
	STEP_MAX: 3,
	STEP_PAUSE_MS: [3000, 3000, 3000, 3000],
	MIN_VISIBLE_MS: 16000,
	cap: 20,                // 20 → 40 → 60 → 80 → 100
	CLOSE_DELAY_MS: 4000,
	startedAt: 0
};

function startLoader() {
	LOADER.startedAt = performance.now();
	LOADER.done = false;
	if (LOADER.timer) clearInterval(LOADER.timer);
	if (LOADER.stepTimer) clearTimeout(LOADER.stepTimer);

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

	let progress = 0;
	let level    = 1;

	if ($text) $text.textContent = '초기화';
	LOADER.cap = 20;
	LOADER.timer = setInterval(tick, LOADER.TICK_MS);

	function tick() {
		if (LOADER.done) return;
		if (!$bar) return;

		if (progress < LOADER.cap) {
			progress += rand(LOADER.STEP_MIN, LOADER.STEP_MAX);
			if (progress > LOADER.cap) progress = LOADER.cap;
			$bar.style.width = progress + '%';
			$bar.setAttribute('aria-valuenow', String(progress));
			return;
		}

		if (LOADER.done) return;

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
		LOADER.stepTimer = setTimeout(() => {
            if (LOADER.done) return;
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
		LOADER.done = true;
		if (LOADER.timer) clearInterval(LOADER.timer);
		if (LOADER.stepTimer) clearTimeout(LOADER.stepTimer);

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
// 더미(그리고 API 실패 폴백도 동일 로직을 사용)
// 1. 범위 보정
function makeDummyForecast(fromYear, toYear) {
	const a = parseInt(fromYear, 10);
	const b = parseInt(toYear, 10);
	const from = Number.isFinite(a) ? a : 2024;
	const to   = Number.isFinite(b) ? b : 2030;
	const [lo, hi] = from <= to ? [from, to] : [to, from];

	// 2. 라벨
	const years = [];
	for (let y = lo; y <= hi; y++) years.push(String(y));
	const L = years.length;

	// 3) 파라미터(원하면 여기만 조정)
	const baseKwh       = 2_150_000; // 시작 에너지 사용량 (막대 첫 해)
	const afterRate     = 0.06;     // 막대: 매년 5% 감소  (↗ 높이면 더 가파름)
	const startSaving   = 360_000;   // 절감량 첫 해(kWh)    (꺾은선 첫 점 높이)
	const savingRate    = 0.08;      // 절감량: 매년 8% 감소 (↗ 높이면 더 가파름)
	const UNIT_PRICE    = 150;       // 1kWh당 원 (꺾은선 전체 스케일)

	// 4) 기하(퍼센트) 감소 수식
	const after  = Array.from({ length: L }, (_, i) =>
		Math.max(0, Math.round(baseKwh * Math.pow(1 - afterRate, i)))
	);

	const saving = Array.from({ length: L }, (_, i) =>
		Math.max(0, Math.round(startSaving * Math.pow(1 - savingRate, i)))
	);

	const savingCost = saving.map(k => k * UNIT_PRICE);

	return {
		years,
		series: { after, saving },
		cost: { saving: savingCost },
		kpi: null
	};
}

async function fetchForecast(buildingId, fromYear, toYear) {
	// 안전한 범위 계산 (같으면 7년 확장)
	const a = parseInt(fromYear, 10);
	const b = parseInt(toYear, 10);
	let from = Number.isFinite(a) ? a : 2024;
	let to   = Number.isFinite(b) ? b : 2030;
	if (to < from) [from, to] = [to, from];
	if (to === from) to = from + 6;

	const [lo, hi] = [from, to];
	const years = range(lo, hi);
	const hasId = typeof buildingId === 'string' && /^\d+$/.test(buildingId);

	// builtYear 준비 : data-built-year 또는 window.savegreen.builtYear
	const root = document.getElementById('forecast-root');
	const by1 = Number(root?.dataset?.builtYear);
	const by2 = Number(window?.savegreen?.builtYear);
	const builtYear = Number.isFinite(by1) && by1 > 0 ? by1
					: (Number.isFinite(by2) && by2 > 0 ? by2 : null);

	// 쿼리 구성
	const q = new URLSearchParams({ from: lo, to: hi});
	if (builtYear) q.append('builtYear', String(builtYear));

	const base = hasId ? `/api/forecast/${encodeURIComponent(buildingId)}` : `/api/forecast`;
	const url  = `${base}?` + q.toString();

	try {
		const rsp = await fetch(url, { headers: { 'Accept': 'application/json' } });
		if (!rsp.ok) throw new Error('HTTP ' + rsp.status);
		const json = await rsp.json();
		return normalizeForecast(json, years);
	} catch (e) {
		console.error('[forecast] fetch failed, using fallback dummy:', e);
		// 폴백도 더미 생성기와 동일 규칙 사용
		return makeDummyForecast(lo, hi);
	}
}

function normalizeForecast(d, fallbackYears) {
	const years  = Array.isArray(d?.years) ? d.years : fallbackYears.map(String);
	const L      = years.length;

	const toNumArr = (arr, len) =>
		Array.from({ length: len }, (_, i) => {
			const v = (Array.isArray(arr) ? arr[i] : undefined);
			const n = Number(v);
			return Number.isFinite(n) ? n : 0;
		});

	const after  = toNumArr(d?.series?.after,  L);
	const saving = toNumArr(d?.series?.saving, L);
	const cost   = { saving: toNumArr(d?.cost?.saving, L) };
	const kpi    = d?.kpi ?? null;

	return { years, series: { after, saving }, cost, kpi };
}

/* ---------- KPI / 상태 / 출력 ---------- */
function computeKpis({ years, series, cost, kpiFromApi }) {
	if (kpiFromApi && isFinite(kpiFromApi.savingCostYr)) return kpiFromApi;

	const i = Math.max(0, years.length - 1);
	const afterKwh   = +series.after[i] || 0;
	const savingKwh  = +series.saving[i] || 0;
	const savingCost = +((cost?.saving || [])[i]) || Math.round(savingKwh * 120);

	const beforeKwh  = afterKwh + savingKwh;
	const savingPct  = beforeKwh > 0 ? Math.round((savingKwh / beforeKwh) * 100) : 0;

	const paybackYears = clamp((afterKwh / Math.max(1, savingKwh)) * 0.8, 3, 8);

	return { savingCostYr: savingCost, savingKwhYr: savingKwh, savingPct, paybackYears };
}

function estimateEnergyGrade(savingPct) {
	if (savingPct >= 30) return 1;
	if (savingPct >= 20) return 2;
	if (savingPct >= 10) return 3;
	return 4;
}


/* 점수 기반 배너 판정

점수 규칙:
절감률: ≥15% → 2점 / 10–14% → 1점 / <10% → 0점
회수기간: ≤5년 → 2점 / 6–8년 → 1점 / >8년 → 0점
연식: ≥25년 → 2점 / 10–24년 → 1점 / <10년 → 0점
(연식 미상은 1점 중립)

savingPct(절감률) < 5 또는 paybackYears(회수기간) > 12 ⇒ 무조건 비추천
(원치 않는 과대판정 방지)

최종 배너:
합계 ≥4 → 추천 / 2–3 → 조건부 / 0–1 → 비추천 (가드가 우선)
*/

function decideStatusByScore(kpi, opts = {}) {
	const now = new Date().getFullYear();
	const savingPct = Number(kpi?.savingPct ?? 0);
	const payback = Number(kpi?.paybackYears ?? Infinity);
	const builtYear = Number(opts?.builtYear);

	let score = 0;

	// 1. 절감률
	if (savingPct >= 15) score += 2;
	else if (savingPct >= 10) score += 1;

	// 2. 회수기간
	if (payback <= 5) score += 2;
	else if (payback <= 8) score += 1;

	// 3. 연식(없으면 중립 1점)
	let agePt = 1;
	if (Number.isFinite(builtYear) && builtYear > 0 && builtYear <= now) {
		const age = now - builtYear;
		if (age >= 25) agePt = 2;
		else if (age >= 10) agePt = 1;
		else agePt = 0;
	}
	score += agePt;

	// 가드(원치않는 과대판정 방지)
	if (savingPct < 5 || payback > 12) return { label: 'not-recommend', score};

	const label = (score >= 4) ? 'recommend'
				: (score >= 2) ? 'conditional'
				: 'not-recommend';
	return { label, score };
}

function applyStatus(status) {
	const banner = $('#status-banner');
	const result = $('#result-section');
	const classes = ['recommend', 'conditional', 'not-recommend'];

	classes.forEach((c) => { banner?.classList?.remove(c); result?.classList?.remove(c); });

	if (classes.includes(status)) {
		banner?.classList?.add(status);
		result?.classList?.add(status);
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

/* 결과 요약 */
function renderSummary({ gradeNow /*, kpi*/ }) {
	const ul = $('#summary-list');
	if (!ul) return;
	ul.innerHTML = '';

	const targetGrade   = Math.max(1, gradeNow - 1);
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

	const BAR_GROW_MS  = 2000;
	const BAR_GAP_MS   = 500;
	const POINT_MS     = 600;
	const POINT_GAP_MS = 200;

	const labels  = years.map(String);
	const bars    = series.after.slice(0, labels.length);
	const costs   = (cost?.saving || []).slice(0, labels.length);
	const n       = labels.length;

	const BAR_BG      = 'rgba(54, 162, 235, 0.5)'; // 막대 반투명
	const BAR_BORDER  = 'rgb(54, 162, 235)';
	const LINE_ORANGE = '#F57C00';

	function fromBaseline(ctx) {
		const chart  = ctx.chart;
		const ds     = chart.data.datasets[ctx.datasetIndex];
		const axisId = ds.yAxisID || (ds.type === 'line' ? 'yCost' : 'yEnergy');
		const scale  = chart.scales[axisId];
		return scale.getPixelForValue(0);
	}

	const totalBarDuration   = n * (BAR_GROW_MS + BAR_GAP_MS);
	const pointStartAt       = totalBarDuration + 200; // 버퍼 200ms
	const totalPointDuration = n * (POINT_MS + POINT_GAP_MS);
	const lineRevealAt       = pointStartAt + totalPointDuration;

	// 라인(선/점) 데이터셋
	const lineDs = {
		type: 'line',
		order: 9999,
		label: '비용 절감',
		data: costs,
		yAxisID: 'yCost',
		tension: 0.3,
		spanGaps: false,
		fill: false,
		showLine: false,
		pointRadius: new Array(n).fill(0),
		borderWidth: 3,
		borderColor: LINE_ORANGE,
		backgroundColor: LINE_ORANGE,
		pointBackgroundColor: LINE_ORANGE,
		pointBorderWidth: 0,
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

	// 막대 데이터셋
	const barDs = {
		type: 'bar',
		order: 1,
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
	};

	// 막대 위에 라인을 항상 올리는 플러그인
	const forceLineFront = {
		id: 'forceLineFront',
		afterDatasetsDraw(chart) {
			const idx = chart.data.datasets.indexOf(lineDs);
			if (idx < 0) return;
			const meta = chart.getDatasetMeta(idx);
			if (!meta) return;
			const { ctx } = chart;
			meta.dataset?.draw?.(ctx);
			if (Array.isArray(meta.data)) {
				meta.data.forEach(el => el?.draw && el.draw(ctx));
			}
		}
	};

	energyChart = new Chart(ctx, {
		type: 'bar',
		data: { labels, datasets: [barDs, lineDs] },
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
				},
				forceLineFront: {}
			},
			elements: { point: { hoverRadius: 5 } },
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
		},
		plugins: [forceLineFront]
	});

	// 포인트 순차 등장
	for (let i = 0; i < n; i++) {
		const delay = pointStartAt + i * (POINT_MS + POINT_GAP_MS);
		setTimeout(() => {
			lineDs.pointRadius[i] = 3;
			energyChart.update('none');
		}, delay);
	}

	// 모든 점 등장 후 선을 보이기
	setTimeout(() => {
		barDs.animations = false;
		lineDs.showLine = true;
		energyChart.update('none');
	}, lineRevealAt + 50);

	window.energyChart = energyChart;
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
function range(a, b) { const arr = []; for (let y = a; y <= b; y++) arr.push(y); return arr; }
function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
function $(s, root = document) { return root.querySelector(s); }
function $all(s, root = document) { return Array.from(root.querySelectorAll(s)); }
function show(el){ if (el) el.classList.remove('hidden'); }
function hide(el){ if (el) el.classList.add('hidden'); }

/* VWorld Bridge : 좌표 + PNU + 건물정보 + builtYear */
(function () {
	const VWORLD_KEY = "AED66EDE-3B3C-3034-AE11-9DBA47236C69";

	async function getPnuFromLonLat(lon, lat) {
		const url = new URL('https://api.vworld.kr/req/data');
		url.search = new URLSearchParams({
			service: 'data',
			request: 'GetFeature',
			data: 'lp_pa_cbnd_bubun',
			format: 'json',
			size: '1',
			key: VWORLD_KEY,
			geomFilter: 'point(${lon} ${lat}',
			geometry: 'false'
		}).toString();

		const res = await fetch(url);
		if (!res.ok) throw new Error('PNU 조회 실패');
		const j = await res.json();
		const feats = j?.response?.result?.featureCollection?.features;
		const props = feats && feats[0]?.properties;
		return props?.PNU || props?.pnu || null;
	}

	async function getBuildingInfo(pnu) {
		if (!pnu) return null;
		const url = new URL('https://api.vworld.kr/ned/data/getBuildingUse');
		url.search = new URLSearchParams({
			key: VWORLD_KEY,
			format: 'json',
			pnu,
			numOfRows: '1'
		}).toString();

		const res = await fetch(url);
		if (!res.ok) throw new Error('건물 정보 조회 실패');
		const j = await res.json();

		const items =
			j?.response?.result?.item ||
			j?.response?.result?.featureCollection?.features ||
			[];
		const first = items[0]?.properties || items[0] || null;
		return first;
	}

	function extractBuiltYear(info) {
		const ymd = info?.useConfmDe || info?.USECFMDE;
		if (!ymd) return null;
		const s = String(ymd);
		return s.length >= 4 ? Number(s.slice(0, 4)) : null;
	}

	window.savegreenSetBuiltYearFromCoord = async function (lon, lat) {
		try {
			const pnu = await getPnuFromLonLat(lon, lat);
			if (!pnu) {
				alert('이 지점의 고유번호(PNU) 정보를 찾지 못했습니다.');
				return;
			}

			const info = await getBuildingInfo(pnu);
			const by = extractBuiltYear(info);
			if (!by) {
				alert('준공연도(useConfmDe) 정보를 찾지 못했습니다.');
				return;
			}

			window.savegreen = window.savegreen || {};
			window.savegreen.builtYear = by;

			const root = document.getElementById('forecast-root');
			if (root) root.dataset.builtYear = String(by);

			await reloadForecast();
		} catch (e) {
			console.error('[vworld] builtYear set failed : ', e);
			alert('연식 자동 감지 중 오류가 발생했습니다.');
		}
	};

	window.savegreenSetBuiltYearFromPnu = async function (pnu) {
		try {
			const info = await getBuildingInfo(pnu);
			const by = extractBuiltYear(info);
			if (!by) {
				alert('준공연도(useConfmde) 정보를 찾지 못했습니다.');
				return;
			}

			window.savegreen = window.savegreen || {};
			window.savegreen.builtYear = by;

			const root = document.getElementById('forecast-root');
			if (root) root.dataset.builtYear = String(by);

			await reloadForecast();
		} catch (e) {
			console.error('[vworld] builtYear set (from pnu) failed : ', e);
			alert('연식 자동 감지 중 오류가 발생했습니다.');
		}
	};
})();
