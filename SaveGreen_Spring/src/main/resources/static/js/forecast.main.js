/* =========================
 * forecast.main.js (FINAL)
 * - 컨텍스트 확보 후 로더 시작
 * - 컨텍스트 없으면 더미만 렌더(백엔드 호출 X)
 * - builtYear=0/무효 → API 쿼리에 포함하지 않음
 * - 기본 기간: 현재연도(NOW_YEAR) ~ NOW_YEAR+HORIZON_YEARS
 * ========================= */

// 전역 네임스페이스 보장(ESM 미사용 환경용)
window.SaveGreen = window.SaveGreen || {};
window.SaveGreen.Forecast = window.SaveGreen.Forecast || {};

document.addEventListener('DOMContentLoaded', () => {
	init().catch(err => console.error('[forecast] init failed:', err));
});

/* ---------- 고정 텍스트 ---------- */
const BANNER_TEXTS = {
	recommend: '연식과 향후 비용 리스크를 고려할 때, 리모델링을 권장합니다.',
	conditional: '일부 항목은 적정하나, 향후 효율과 수익성 검토가 필요합니다.',
	'not-recommend': '현재 조건에서 리모델링 효과가 제한적입니다.'
};

/* ---------- 예측 기간 상수(전역) ---------- */
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

/* ---------- Provider 쿼리 빌더 ---------- */
function buildCtxQuery(ctx) {
	const params = new URLSearchParams();
	params.set('from', String(ctx.from ?? NOW_YEAR));
	params.set('to', String(ctx.to ?? (NOW_YEAR + HORIZON_YEARS)));
	if (Number(ctx.builtYear) > 0) params.set('builtYear', String(ctx.builtYear));
	setIf(params, 'useName', ctx.useName);
	setIf(params, 'floorArea', ctx.floorArea);
	setIf(params, 'area', ctx.area);
	setIf(params, 'pnu', ctx.pnu);
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
			dongName: get('dongName') || get('bdong'),
			buildingIdent: get('buildingIdent') || get('bident'),
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
	// label이 아니라 status를 전달
	applyStatus(statusObj.status);
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

	// label이 아니라 status를 전달
	applyStatus(statusObj.status);
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

function estimateEnergyGrade(savingPct) {
	if (savingPct >= 30) return 1;
	if (savingPct >= 20) return 2;
	if (savingPct >= 10) return 3;
	return 4;
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

	// 핵심 정보 없으면 카드 숨김
	if (!rows.length) { box.classList.add('hidden'); box.innerHTML = ''; return; }

	// 보조 필드 (쿼리출처 qs면 비노출)
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

/* /forecast 빈 진입 등 컨텍스트가 전혀 없을 때의 기본값 생성 */
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