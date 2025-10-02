/* =========================
 * forecast.js (FINAL)
 * - 컨텍스트 확보 후 로더 시작
 * - 컨텍스트 없으면 더미만 렌더(백엔드 호출 X)
 * - builtYear=0/무효 → API 쿼리에 포함하지 않음
 * - 기본 기간: 현재연도(NOW_YEAR) ~ NOW_YEAR+HORIZON_YEARS
 * ========================= */

document.addEventListener('DOMContentLoaded', () => {
	init().catch(err => console.error('[forecast] init failed:', err));
});

/* ---------- 고정 텍스트 ---------- */
const BANNER_TEXTS = {
	recommend: '연식과 향후 비용 리스크를 고려할 때, 리모델링을 권장합니다.',
	conditional: '일부 항목은 적정하나, 향후 효율과 수익성 검토가 필요합니다.',
	'not-recommend': '현재 조건에서 리모델링 효과가 제한적입니다.'
};

/* ---------- 예측 기간 상수(전역) ----------
 * NOW_YEAR       : 현재 연도
 * HORIZON_YEARS  : NOW_YEAR로부터 몇 년까지 예측할지(포함)
 * 예) NOW_YEAR=2025, HORIZON_YEARS=10 → 2025 ~ 2035
 * ---------------------------------------- */
const NOW_YEAR = new Date().getFullYear();
const HORIZON_YEARS = 10;

/* ---------- Header offset ---------- */
function applyHeaderOffset() {
	const menubar = document.getElementById('menubar');
	const spacer = document.querySelector('.header-spacer');
	const wrap = document.querySelector('main.wrap');
	if (!wrap || !spacer) return;

	let overlay = false;
	let h = 0;

	if (menubar) {
		const cs = getComputedStyle(menubar);
		const rect = menubar.getBoundingClientRect();
		const isFixed = cs.position === 'fixed';
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

/* ---------- Provider 쿼리 빌더 ----------
 * 컨텍스트를 쿼리스트링으로 직렬화(정의된 필드만 포함)
 * builtYear는 양수(>0)일 때만 포함
 * -------------------------------------- */
function buildCtxQuery(ctx) {
	const params = new URLSearchParams();
	params.set('from', String(ctx.from ?? NOW_YEAR));
	params.set('to', String(ctx.to ?? (NOW_YEAR + HORIZON_YEARS)));
	if (Number(ctx.builtYear) > 0) params.set('builtYear', String(ctx.builtYear));
	setIf(params, 'useName', ctx.useName);
	setIf(params, 'floorArea', ctx.floorArea);
	setIf(params, 'area', ctx.area);
	setIf(params, 'pnu', ctx.pnu);
	// 필요 시 lat/lon 등 추가 가능
	return params.toString();
}
function setIf(params, key, value) {
	if (value == null || String(value).trim() === '') return;
	params.set(key, String(value));
}

/* ---------- 초기화 ---------- */
async function init() {
	initHeaderOffset();

	const root = document.getElementById('forecast-root');

	/* 주소창 → data-* Fallback 주입 (+출처 플래그 qs) */
	{
		const urlp = new URLSearchParams(location.search);
		if (root && !root.dataset.pnu && urlp.get('pnu')) {
			root.dataset.pnu = urlp.get('pnu');
			root.dataset.pnuFrom = 'qs';
		}
		if (root && !root.dataset.builtYear && urlp.get('builtYear')) {
			root.dataset.builtYear = urlp.get('builtYear');
			root.dataset.builtYearFrom = 'qs';
		}
		if (root && !root.dataset.from && urlp.get('from')) root.dataset.from = urlp.get('from');
		if (root && !root.dataset.to && urlp.get('to')) root.dataset.to = urlp.get('to');
	}

	console.log('[forecast] dataset', {
		from: root?.dataset.from,
		to: root?.dataset.to,
		builtYear: root?.dataset.builtYear,
		pnu: root?.dataset.pnu,
		bid: root?.dataset.bid
	});

	// Building info from dataset
	const BUILD = (function (root) {
		const get = (k) => (root?.dataset?.[k] ?? '').trim();
		const num = (k) => { const s = get(k).replace(/,/g, ''); const n = Number(s); return Number.isFinite(n) ? n : null; };
		const int = (k) => { const s = get(k); const n = parseInt(s, 10); return Number.isFinite(n) ? n : null; };
		const by = Number(get('builtYear'));
		return {
			pnu: get('pnu'),
			use: get('use'),
			area: num('area'),
			plotArea: num('plotArea'),
			floorsAbove: int('floorsAbove'),
			floorsBelow: int('floorsBelow'),
			height: num('height'),
			approvalDate: get('approvalDate'),
			buildingName: get('bname'),
			dongName: get('bdong'),
			buildingIdent: get('bident'),
			lotSerial: get('lotSerial'),
			builtYear: Number.isFinite(by) && by > 0 ? by : null
		};
	})(root);
	window.BUILDING_INFO = BUILD;

	// 빌딩 카드 렌더(데이터 세팅 직후)
	renderBuildingCard();

	const $result = $('#result-section');
	const $ml = $('#mlLoader');

	/* 컨텍스트 확보 (실패 시 더미로 폴백) */
	let ctx, useDummy = false;
	try {
		ctx = await getBuildingContext();	// (page → local → url → vworld)
		console.info('[forecast] ctx =', ctx);
	} catch (e) {
		console.warn('[forecast] no context → fallback to dummy', e);
		ctx = fallbackDefaultContext(root);
		useDummy = true;
	}

	// 로더는 컨텍스트 확보 후 시작
	show($ml); hide($result);
	startLoader();

	// 데이터 로드 (더미/실데이터 분기)
	const data = useDummy ? makeDummyForecast(ctx.from, ctx.to)
		: await fetchForecast(ctx);
	window.FORECAST_DATA = data;

	// 길이/타입 강제 정렬
	{
		const expectedYears = Array.isArray(data.years) ? data.years.map(String) : [];
		const L = expectedYears.length;

		data.years = expectedYears;
		data.series = data.series || {};
		data.cost = data.cost || {};

		const toNumArr = (arr, len) =>
			Array.from({ length: len }, (_, i) => {
				const v = (Array.isArray(arr) ? arr[i] : undefined);
				const n = Number(v);
				return Number.isFinite(n) ? n : 0;
			});

		data.series.after = toNumArr(data.series.after, L);
		data.series.saving = toNumArr(data.series.saving, L);
		data.cost.saving = toNumArr(data.cost.saving, L);
	}

	console.debug('[forecast] aligned lengths', {
		years: data.years.length,
		after: data.series.after.length,
		saving: data.series.saving.length,
		costSaving: data.cost.saving.length,
		from: (typeof ctx?.from !== 'undefined' ? ctx.from : undefined),
		to: (typeof ctx?.to !== 'undefined' ? ctx.to : undefined),
		bid: (typeof ctx?.buildingId !== 'undefined' ? ctx.buildingId : undefined)
	});

	// 메타패널(데이터 범위/모델/특성) 동적 표기
	updateMetaPanel({
		years: window.FORECAST_DATA.years,
		model: 'Linear Regression',
		features: (function () {
			const feats = ['연도'];
			if (Array.isArray(window.FORECAST_DATA?.series?.after)) feats.push('사용량');
			if (Array.isArray(window.FORECAST_DATA?.cost?.saving)) feats.push('비용 절감');
			return feats;
		})()
	});

	// KPI & 출력
	const kpi = computeKpis({
		years: data.years,
		series: data.series,
		cost: data.cost,
		kpiFromApi: data.kpi
	});

	const gradeNow = estimateEnergyGrade(kpi.savingPct);
	const builtYear = Number(document.getElementById('forecast-root')?.dataset.builtYear) || Number(ctx?.builtYear);
	const statusObj = decideStatusByScore(kpi, { builtYear });

	console.debug('[forecast] status', statusObj);
	applyStatus(statusObj.label);
	window._STATUS_SCORE_ = statusObj.score;
	window.__STATUS__ = statusObj;

	// 렌더(등급/KPI/요약)
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

	const $result = $('#result-section');
	const $ml = $('#mlLoader');

	// 컨텍스트 재수집(실패 시 더미)
	let ctx, useDummy = false;
	try {
		ctx = await getBuildingContext();
	} catch (e) {
		console.warn('[forecast] reload→dummy', e);
		ctx = fallbackDefaultContext(root);
		useDummy = true;
	}

	// 로더 표시
	show($ml);
	hide($result);
	startLoader();

	// 데이터 로드
	const data = useDummy ? makeDummyForecast(ctx.from, ctx.to)
		: await fetchForecast(ctx);
	window.FORECAST_DATA = data;

	// 길이/타입 강제 정렬(init와 동일)
	{
		const expectedYears = Array.isArray(data.years) ? data.years.map(String) : [];
		const L = expectedYears.length;

		data.years = expectedYears;
		data.series = data.series || {};
		data.cost = data.cost || {};

		const toNumArr = (arr, len) =>
			Array.from({ length: len }, (_, i) => {
				const v = (Array.isArray(arr) ? arr[i] : undefined);
				const n = Number(v);
				return Number.isFinite(n) ? n : 0;
			});

		data.series.after = toNumArr(data.series.after, L);
		data.series.saving = toNumArr(data.series.saving, L);
		data.cost.saving = toNumArr(data.cost.saving, L);
	}

	// 메타패널 업데이트
	updateMetaPanel({
		years: window.FORECAST_DATA.years,
		model: 'Linear Regression',
		features: (function () {
			const feats = ['연도'];
			if (Array.isArray(window.FORECAST_DATA?.series?.after)) feats.push('사용량');
			if (Array.isArray(window.FORECAST_DATA?.cost?.saving)) feats.push('비용 절감');
			return feats;
		})()
	});

	// KPI / 판정 / 요약
	const kpi = computeKpis({
		years: data.years,
		series: data.series,
		cost: data.cost,
		kpiFromApi: data.kpi
	});

	const gradeNow = estimateEnergyGrade(kpi.savingPct);
	const builtYear = Number(document.getElementById('forecast-root')?.dataset.builtYear) || Number(ctx?.builtYear);
	const statusObj = decideStatusByScore(kpi, { builtYear });

	applyStatus(statusObj.label);
	window._STATUS_SCORE_ = statusObj.score;
	window.__STATUS__ = statusObj;

	renderKpis(kpi, { gradeNow });
	renderSummary({ gradeNow, kpi });

	await ensureMinLoaderTime();
	await finishLoader();
	hide($ml);
	show($result);

	await renderEnergyComboChart({
		years: data.years,
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
	cap: 20,				// 20 → 40 → 60 → 80 → 100
	CLOSE_DELAY_MS: 4000,
	startedAt: 0
};

function startLoader() {
	LOADER.startedAt = performance.now();
	LOADER.done = false;
	if (LOADER.timer) clearInterval(LOADER.timer);
	if (LOADER.stepTimer) clearTimeout(LOADER.stepTimer);

	const $bar = $('#progressBar');
	const steps = $all('.progress-map .step');
	const $text = $('#mlStatusText');
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
	let level = 1;

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
		if ($text) $text.textContent = labels[level] || '진행 중';

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
function makeDummyForecast(fromYear, toYear) {
	// 1) 입력 정규화
	let from = parseInt(fromYear, 10);
	let to = parseInt(toYear, 10);

	if (!Number.isFinite(from)) from = NOW_YEAR;
	if (!Number.isFinite(to)) to = from + HORIZON_YEARS;

	// 2) 범위 보정
	if (to < from) [from, to] = [to, from];
	if (to === from) to = from + HORIZON_YEARS;

	// 3) 연도/데이터 생성
	const years = [];
	for (let y = from; y <= to; y++) years.push(String(y));
	const L = years.length;

	const baseKwh = 2_150_000;
	const afterRate = 0.06;
	const startSaving = 360_000;
	const savingRate = 0.08;
	const UNIT_PRICE = 150;

	const after = Array.from({ length: L }, (_, i) =>
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

async function fetchForecast(ctx) {
	// 1) from/to 보정
	let from = parseInt(String(ctx.from ?? NOW_YEAR), 10);
	let to = parseInt(String(ctx.to ?? (NOW_YEAR + HORIZON_YEARS)), 10);
	if (!Number.isFinite(from)) from = NOW_YEAR;
	if (!Number.isFinite(to)) to = from + HORIZON_YEARS;
	if (to < from) [from, to] = [to, from];
	if (to === from) to = from + HORIZON_YEARS;

	const [lo, hi] = [from, to];
	const years = range(lo, hi);

	// 2) 컨텍스트로 쿼리 구성(id 없는 케이스 대비)
	const qs = buildCtxQuery({ ...ctx, from: lo, to: hi });

	// 3) URL 구성
	const hasId = ctx.buildingId != null && String(ctx.buildingId).trim() !== '';
	const base = hasId ? `/api/forecast/${encodeURIComponent(String(ctx.buildingId))}` : `/api/forecast`;
	const url = `${base}?${qs}`;

	console.log('[forecast] API URL =>', url);

	// 4) 호출 + 정상화
	try {
		const rsp = await fetch(url, { headers: { 'Accept': 'application/json' } });
		if (!rsp.ok) throw new Error('HTTP ' + rsp.status);
		const json = await rsp.json();
		return normalizeForecast(json, years);
	} catch (e) {
		console.error('[forecast] fetch failed, using fallback dummy:', e);
		return makeDummyForecast(lo, hi);
	}
}

function normalizeForecast(d, fallbackYears) {
	const years = Array.isArray(d?.years) ? d.years : fallbackYears.map(String);
	const L = years.length;

	const toNumArr = (arr, len) =>
		Array.from({ length: len }, (_, i) => {
			const v = (Array.isArray(arr) ? arr[i] : undefined);
			const n = Number(v);
			return Number.isFinite(n) ? n : 0;
		});

	const after = toNumArr(d?.series?.after, L);
	const saving = toNumArr(d?.series?.saving, L);
	const cost = { saving: toNumArr(d?.cost?.saving, L) };
	const kpi = d?.kpi ?? null;

	return { years, series: { after, saving }, cost, kpi };
}

/* ---------- KPI / 상태 / 출력 ---------- */
function computeKpis({ years, series, cost, kpiFromApi }) {
	if (kpiFromApi && isFinite(kpiFromApi.savingCostYr)) return kpiFromApi;

	const i = Math.max(0, years.length - 1);
	const afterKwh = +series.after[i] || 0;
	const savingKwh = +series.saving[i] || 0;
	const savingCost = +((cost?.saving || [])[i]) || Math.round(savingKwh * 120);

	const beforeKwh = afterKwh + savingKwh;
	const savingPct = beforeKwh > 0 ? Math.round((savingKwh / beforeKwh) * 100) : 0;

	const paybackYears = clamp((afterKwh / Math.max(1, savingKwh)) * 0.8, 3, 8);

	return { savingCostYr: savingCost, savingKwhYr: savingKwh, savingPct, paybackYears };
}

function estimateEnergyGrade(savingPct) {
	if (savingPct >= 30) return 1;
	if (savingPct >= 20) return 2;
	if (savingPct >= 10) return 3;
	return 4;
}

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

	// 가드
	if (savingPct < 5 || payback > 12) return { label: 'not-recommend', score };

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
	if (msg) msg.textContent = BANNER_TEXTS[status] || '';
	if (badge) badge.textContent =
		status === 'recommend' ? '추천' :
			status === 'conditional' ? '조건부' : '비추천';
}

/* 메타 패널: 데이터 범위/모델/특성 동적 표기 */
function updateMetaPanel({ years, model, features }) {
	const fromY = Number(years?.[0]);
	const toY = Number(years?.[years?.length - 1]);

	// 데이터 범위
	const rangeEl = document.getElementById('meta-data-range');
	if (rangeEl) {
		let text = '-';
		if (Number.isFinite(fromY) && Number.isFinite(toY)) {
			text = (fromY === toY) ? `${fromY}년` : `${fromY}~${toY} 연간`;
		}
		rangeEl.textContent = text;
	}

	// 모델명(옵션)
	const modelEl = document.getElementById('meta-model');
	if (modelEl && model) modelEl.textContent = model;

	// 특성(옵션)
	const featEl = document.getElementById('meta-features');
	if (featEl && Array.isArray(features) && features.length) {
		featEl.textContent = features.join(', ');
	}
}

function renderKpis(kpi, { gradeNow }) {
	const g = $('#kpi-grade');
	const sc = $('#kpi-saving-cost');
	const pb = $('#kpi-payback');
	const sp = $('#kpi-saving-pct');

	if (g) g.textContent = String(gradeNow);
	if (sc) sc.textContent = nf(kpi.savingCostYr);
	if (pb) pb.textContent = (Math.round(kpi.paybackYears * 10) / 10).toFixed(1);
	if (sp) sp.textContent = kpi.savingPct + '%';
}

/* 결과 요약 */
function renderSummary({ gradeNow /*, kpi*/ }) {
	const ul = $('#summary-list');
	if (!ul) return;
	ul.innerHTML = '';

	const targetGrade = Math.max(1, gradeNow - 1);
	const currentEui = euiRefForGrade(gradeNow);
	const boundaryEui = euiRefForGrade(targetGrade);
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

	const areaForEui = window.BUILDING_INFO?.floorArea || window.BUILDING_INFO?.area || null;
	if (areaForEui && Array.isArray(window.FORECAST_DATA?.series?.after)) {
		const arr = window.FORECAST_DATA.series.after;
		const last = Number(arr[arr.length - 1] || 0);
		const euiNow = last > 0 ? Math.round(last / areaForEui) : 0;
		const li = document.createElement('li');
		li.innerHTML = `추정 현재 EUI : <strong>${nf(euiNow)} kWh/m^2/년</strong>`;
		ul.appendChild(li);
	}
}

function renderBuildingCard() {
	const box = document.getElementById('building-card');
	if (!box) return;

	const b = window.BUILDING_INFO || {};
	const root = document.getElementById('forecast-root');

	const fromQs = (k) => (root?.dataset?.[k + 'From'] === 'qs');

	const rows = [];
	const row = (k, v) => `<div class="row"><span class="k">${k}</span><span class="v">${v}</span></div>`;
	const esc = (t) => String(t).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));

	// 핵심 필드(표시 여부 결정)
	if (b.buildingName) rows.push(row('건물명', esc(b.buildingName)));
	if (b.dongName) rows.push(row('동명', esc(b.dongName)));
	if (b.buildingIdent) rows.push(row('식별번호', esc(b.buildingIdent)));
	if (b.lotSerial) rows.push(row('지번', esc(b.lotSerial)));
	if (b.use) rows.push(row('용도', esc(b.use)));
	if (b.approvalDate) rows.push(row('사용승인일', esc(fmtYmd(b.approvalDate))));
	if (b.area) rows.push(row('건축면적', nf(b.area) + ' m²'));
	if (b.plotArea) rows.push(row('대지면적', nf(b.plotArea) + ' m²'));
	if (b.height) rows.push(row('높이', nf(b.height) + ' m'));
	if (b.floorsAbove != null || b.floorsBelow != null) {
		rows.push(row('지상/지하', `${b.floorsAbove ?? 0} / ${b.floorsBelow ?? 0}`));
	}

	// 핵심 정보 없으면 카드 숨김 (URL 파라미터만 들어온 경우 노출 X)
	if (!rows.length) { box.classList.add('hidden'); box.innerHTML = ''; return; }

	// 보조 필드 (쿼리출처 qs면 비노출, 서버/VWorld 값은 노출)
	if (b.pnu && !fromQs('pnu')) rows.push(row('PNU', esc(b.pnu)));
	if (b.builtYear && !fromQs('builtYear')) rows.push(row('준공연도', String(b.builtYear)));

	box.innerHTML = `<div class="card building-card"><h4>건물 정보</h4>${rows.join('')}</div>`;
	box.classList.remove('hidden');

	function fmtYmd(s) { s = String(s).replace(/\D/g, ''); if (s.length < 8) return s; return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`; }
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

	const BAR_GROW_MS = 2000;
	const BAR_GAP_MS = 300;
	const POINT_MS = 600;
	const POINT_GAP_MS = 200;

	const labels = years.map(String);
	const bars = series.after.slice(0, labels.length);
	const costs = (cost?.saving || []).slice(0, labels.length);
	const n = labels.length;

	const BAR_BG = 'rgba(54, 162, 235, 0.5)';
	const BAR_BORDER = 'rgb(54, 162, 235)';
	const LINE_ORANGE = '#F57C00';

	function fromBaseline(ctx) {
		const chart = ctx.chart;
		const ds = chart.data.datasets[ctx.datasetIndex];
		const axisId = ds.yAxisID || (ds.type === 'line' ? 'yCost' : 'yEnergy');
		const scale = chart.scales[axisId];
		return scale.getPixelForValue(0);
	}

	const totalBarDuration = n * (BAR_GROW_MS + BAR_GAP_MS);
	const pointStartAt = totalBarDuration + 200;
  	const totalPointDuration = n * (POINT_MS + POINT_GAP_MS);
	const lineRevealAt = pointStartAt + totalPointDuration;

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
				x: {
					title: { display: false },
					// 모든 연도 라벨 표시를 원하면 주석 해제
					// ticks: { autoSkip: false }
				}
			}
		},
		plugins: [forceLineFront]
	});

	for (let i = 0; i < n; i++) {
		const delay = pointStartAt + i * (POINT_MS + POINT_GAP_MS);
		setTimeout(() => {
			lineDs.pointRadius[i] = 3;
			energyChart.update('none');
		}, delay);
	}

	setTimeout(() => {
		barDs.animations = false;
		lineDs.showLine = true;
		energyChart.update('none');
	}, lineRevealAt + 50);

	window.energyChart = energyChart;
}

/* ---------- Helpers ---------- */
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
function show(el) { if (el) el.classList.remove('hidden'); }
function hide(el) { if (el) el.classList.add('hidden'); }

/* /forecast 빈 진입 등 컨텍스트가 전혀 없을 때의 기본값 생성
 * - data-*는 참고하지 않고 URL만 확인
 * - URL에도 없으면 NOW_YEAR ~ NOW_YEAR+HORIZON_YEARS */
function fallbackDefaultContext(root) {
	const urlp = new URLSearchParams(location.search);

	let from = parseInt(urlp.get('from') || String(NOW_YEAR), 10);
	let to = parseInt(urlp.get('to') || String(NOW_YEAR + HORIZON_YEARS), 10);

	if (!Number.isFinite(from)) from = NOW_YEAR;
	if (!Number.isFinite(to)) to = from + HORIZON_YEARS;
	if (to < from) [from, to] = [to, from];
	if (to === from) to = from + HORIZON_YEARS;

	let builtYear = parseInt(urlp.get('builtYear') || String(from - 13), 10);
	if (!Number.isFinite(builtYear) || builtYear <= 0) builtYear = from - 13;

	return { from: String(from), to: String(to), builtYear };
}

/* ---------- VWorld Bridge (직접 호출 버전: 개발용) ---------- */
(function () {
	const VWORLD_KEY = "AED66EDE-3B3C-3034-AE11-9DBA47236C69";

	async function getPnuFromLonLat(lon, lat) {
		const url = new URL('https://api.vworld.kr/req/data');
		url.search = new URLSearchParams({
			service: 'data',
			request: 'GetFeature',
			data: 'LP_PA_CBND',
			format: 'json',
			size: '1',
			key: VWORLD_KEY,
			crs: 'EPSG:4326',
			geometry: 'false',
			geomFilter: `point(${lon} ${lat})`
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
			if (root) {
				root.dataset.builtYear = String(by);
				root.dataset.builtYearFrom = 'vworld';
				root.dataset.pnu = pnu;
				root.dataset.pnuFrom = 'vworld';
			}

			renderBuildingCard();
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
			if (root) {
				root.dataset.builtYear = String(by);
				root.dataset.builtYearFrom = 'vworld';
				root.dataset.pnu = pnu;
				root.dataset.pnuFrom = 'vworld';
			}

			renderBuildingCard();
			await reloadForecast();
		} catch (e) {
			console.error('[vworld] builtYear set (from pnu) failed : ', e);
			alert('연식 자동 감지 중 오류가 발생했습니다.');
		}
	};
})();
