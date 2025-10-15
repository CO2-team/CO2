/* =========================
 * forecast.main.js (FINAL)
 * ========================= */

window.SaveGreen = window.SaveGreen || {};
window.SaveGreen.Forecast = window.SaveGreen.Forecast || {};

document.addEventListener('DOMContentLoaded', () => {
	init().catch(err => console.error('[forecast] init failed:', err));
});

// 전역 clamp 폴리필(없으면 등록)
if (typeof window.clamp !== 'function') window.clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));


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
/**
 * 헤더가 fixed/sticky로 겹치는 환경에서,
 * 헤더 실제 높이 + 추가 간격(--header-extra-gap)만큼 본문 상단을 밀어준다.
 * JS가 없을 때는 CSS의 .header-spacer가 동일 역할을 수행.
 */
function applyHeaderOffset() {
	const menubar = document.getElementById('menubar');     // header.html 내부 id 예상
	const spacer = document.querySelector('.header-spacer');
	const wrap = document.querySelector('main.wrap');
	if (!wrap || !spacer) return;

	// CSS 변수에서 추가 간격 읽기(없으면 16px)
	const rootCS = getComputedStyle(document.documentElement);
	const extra = parseInt(rootCS.getPropertyValue('--header-extra-gap')) || 16;

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

	// 문서 루트 변수로 height 알려주고(선택), wrap/spacer에 실제 픽셀 적용
	document.documentElement.style.setProperty('--header-height', h + 'px');

	// 헤더가 겹치면 h+extra, 아니어도 extra는 유지(요청: "조금 더 아래" 시작)
	const topPad = (h + extra) + 'px';
	wrap.style.paddingTop = overlay ? topPad : (extra + 'px');
	spacer.style.height = overlay ? topPad : (extra + 'px');
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

	// 헤더 높이가 변하는 경우(축소/확장, 메뉴 열림 등)
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

	// [추가] Forecast 컨텍스트: localStorage 키 표준(읽기 전용)
	const STORAGE_KEYS = {
		pnu: 'forecast.pnu',
		builtYear: 'forecast.builtYear',
		floorArea: 'forecast.floorArea',
		useName: 'forecast.useName',
		buildingName: 'forecast.buildingName',
		roadAddr: 'forecast.roadAddr',
		jibunAddr: 'forecast.jibunAddr',
		lat: 'forecast.lat',
		lon: 'forecast.lon'
	};

	// [추가] localStorage → dataset 부트스트랩(그린 파인더가 저장해 준 값을 Forecast에서 소비)
	function bootstrapContextFromStorage(rootEl) {
		if (!rootEl) return;

		const read = (k) => window.localStorage.getItem(k) ?? '';

		const ctx = {
			pnu: read(STORAGE_KEYS.pnu),
			builtYear: read(STORAGE_KEYS.builtYear),
			floorArea: read(STORAGE_KEYS.floorArea),
			useName: read(STORAGE_KEYS.useName),
			buildingName: read(STORAGE_KEYS.buildingName),
			roadAddr: read(STORAGE_KEYS.roadAddr),
			jibunAddr: read(STORAGE_KEYS.jibunAddr),
			lat: read(STORAGE_KEYS.lat),
			lon: read(STORAGE_KEYS.lon)
		};

		// dataset 주입(이미 값이 있으면 덮지 않음: 페이지/URL 우선 로직 보존)
		if (ctx.pnu && !rootEl.dataset.pnu) rootEl.dataset.pnu = ctx.pnu;
		if (ctx.builtYear && !rootEl.dataset.builtYear) rootEl.dataset.builtYear = ctx.builtYear;
		if (ctx.floorArea && !rootEl.dataset.area) rootEl.dataset.area = ctx.floorArea;
		if (ctx.useName && !rootEl.dataset.use) rootEl.dataset.use = ctx.useName;

		// 건물명은 기존 키(bname)를 쓰는 코드가 있으므로 둘 다 세팅
		if (ctx.buildingName) {
			if (!rootEl.dataset.bname) rootEl.dataset.bname = ctx.buildingName;
			if (!rootEl.dataset.buildingName) rootEl.dataset.buildingName = ctx.buildingName;
		}
		if (ctx.roadAddr && !rootEl.dataset.roadAddr) rootEl.dataset.roadAddr = ctx.roadAddr;
		if (ctx.jibunAddr && !rootEl.dataset.jibunAddr) rootEl.dataset.jibunAddr = ctx.jibunAddr;
		if (ctx.lat && !rootEl.dataset.lat) rootEl.dataset.lat = ctx.lat;
		if (ctx.lon && !rootEl.dataset.lon) rootEl.dataset.lon = ctx.lon;

		// 디버깅 로그(핵심 값만)
		try {
			const logCtx = {
				pnu: ctx.pnu,
				builtYear: ctx.builtYear,
				floorArea: ctx.floorArea,
				useName: ctx.useName,
				buildingName: ctx.buildingName
			};
			console.log('[forecast] ctx from storage →', logCtx);
		} catch {}
	}

	// [추가] 스토리지 기반 컨텍스트 부트스트랩(주소창 Fallback보다 먼저 수행)
	bootstrapContextFromStorage(root);

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

	// 요소 캐시
	const $result = $('#result-section');
	const $ml = $('#mlLoader');
	const $surface = $('.result-surface'); // KPI/요약/배너 래퍼

	/* 컨텍스트 확보 (실패 시 더미로 폴백) */
	let ctx, useDummy = false;
	try {
		ctx = await getBuildingContext();   // (page → local → url → vworld)
		console.info('[forecast] ctx =', ctx);
	} catch (e) {
		console.warn('[forecast] no context → fallback to dummy', e);
		ctx = fallbackDefaultContext(root);
		useDummy = true;
	}

	// 로더 시작
	show($ml);
	hide($result);
	startLoader();

	// 데이터 로드
	const data = useDummy ? makeDummyForecast(ctx.from, ctx.to) : await fetchForecast(ctx);
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

		// [수정] 0 채움 → Forward-fill 보정
		data.series.after  = toNumArrFFill(data.series.after,  L);
		data.series.saving = toNumArrFFill(data.series.saving, L);
		data.cost.saving   = toNumArrFFill(data.cost.saving,   L);
	}

	// 메타패널
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

	// KPI/판정
	const kpi = computeKpis({
		years: data.years,
		series: data.series,
		cost: data.cost,
		kpiFromApi: data.kpi
	});
	const gradeNow = estimateEnergyGrade(kpi.savingPct);
	const builtYear = Number(document.getElementById('forecast-root')?.dataset.builtYear) || Number(ctx?.builtYear);
	const statusObj = decideStatusByScore(kpi, { builtYear });
	applyStatus(statusObj.status);

	// 로더 종료
	await ensureMinLoaderTime();
	await finishLoader();
	hide($ml);
	show($result);
	if ($surface) hide($surface);

	// ABC 순차 실행 (충분한 버퍼 추가)
	await runABCSequence({
		ctx,
		baseForecast: data,
		onCComplete: () => {
			renderKpis(kpi, { gradeNow });
			renderSummary({ gradeNow, kpi });

			if ($surface) {
				try {
					$surface.style.opacity = '0';
					$surface.style.transform = 'translateY(-12px)';
					show($surface);
					$requestAnimationFramePoly(() => {
						$surface.style.transition = 'opacity 350ms ease, transform 350ms ease';
						$surface.style.opacity = '1';
						$surface.style.transform = 'translateY(0)';
						setTimeout(() => { $surface.style.transition = ''; }, 400);
					});
				} catch { show($surface); }
			}
		}
	});
}

// rAF 보조
function $requestAnimationFramePoly(cb) {
	if (window.requestAnimationFrame) return window.requestAnimationFrame(cb);
	return setTimeout(cb, 16);
}

/* ==========================================================
 * ABC 직렬 시퀀스
 *  - A(점→선·영역) → B(점→선) → C(막대→점→선)
 *  - A/B/C 전환 대기 시간: calcChartAnimMs 기반 + EXTRA_STAGE_HOLD_MS(사용자 요구 2~3초)
 *  - C 완료 후 결과창 노출 지연 최소화
 *  - A/B/C의 우측 비용축을 동일 스케일로 고정(costRange)
 * ========================================================== */
async function runABCSequence({ ctx, baseForecast, onCComplete }) {
	const years = Array.isArray(baseForecast?.years) ? baseForecast.years.map(String) : [];
	const n = years.length;

	const F = window.SaveGreen?.Forecast || {};
	const runModelA = typeof F.runModelA === 'function' ? F.runModelA : undefined;
	const runModelB = typeof F.runModelB === 'function' ? F.runModelB : undefined;
	const makeEnsemble = typeof F.makeEnsemble === 'function' ? F.makeEnsemble : undefined;

	const renderModelAChart = typeof F.renderModelAChart === 'function' ? F.renderModelAChart : undefined;
	const renderModelBChart = typeof F.renderModelBChart === 'function' ? F.renderModelBChart : undefined;
	const renderEnergyComboChart = typeof F.renderEnergyComboChart === 'function' ? F.renderEnergyComboChart : (window.renderEnergyComboChart || undefined);
	const calcChartAnimMs = typeof F.calcChartAnimMs === 'function' ? F.calcChartAnimMs
		: (() => (n * (600 + 120) + 200 + n * (240 + 90) + 50)); // 안전 기본값

	// [NEW] 단계 사이에 추가로 머무는 시간(요구: 2~3초)
	const EXTRA_STAGE_HOLD_MS = 3000; // ← 3000 으로 올리면 3초

	/* ----- 비용축 범위(모든 단계 공통으로 사용) ----- */
	const costArr = Array.isArray(baseForecast?.cost?.saving) ? baseForecast.cost.saving.slice(0, n) : [];
	let cmax = -Infinity;
	for (const v of costArr) {
		const x = Number(v);
		if (Number.isFinite(x) && x > cmax) cmax = x;
	}
	if (!Number.isFinite(cmax)) cmax = 1;

	// 최소값은 항상 0부터 시작
	const cmin = 0;

	// 동적 step + step 기준으로 max를 반올림(눈금 깔끔)
	const step = getNiceStep(cmin, cmax, 6);
   	const rounded = roundMinMaxToStep(cmin, cmax, step);
	const costRange = { min: cmin, max: rounded.max, step };

	/* ----- 모델 or 폴백 ----- */
	function modelOrFallback(id) {
		try {
			if (id === 'A' && runModelA) {
				const out = runModelA(ctx, baseForecast);
				if (out?.yhat && out?.years) return out;
			}
			if (id === 'B' && runModelB) {
				const out = runModelB(ctx, baseForecast);
				if (out?.yhat && out?.years) return out;
			}
		} catch (e) {
			console.warn('[forecast] model error, fallback', id, e);
		}
		// 간단 3점 평균 폴백(기존 의도 유지)
		const src = Array.isArray(baseForecast?.series?.after) ? baseForecast.series.after.slice(0, n) : new Array(n).fill(0);
		const yhat = src.map((v, i, a) => Math.round(((Number(a[i-1] ?? v)) + Number(v) + Number(a[i+1] ?? v)) / 3));
		return { model: { id, version: 'fallback' }, years: years.slice(), yhat };
	}

	/* ----- A ----- */
	const A = modelOrFallback('A');
	// 렌더러 내부에서 애니메이션 종료까지 대기함 → 여기서는 '추가 홀드'만
	await renderModelAChart?.({ years: A.years, yhat: A.yhat, costRange });
	await sleep(EXTRA_STAGE_HOLD_MS);

	/* ----- B ----- */
	const B = modelOrFallback('B');
	await renderModelBChart?.({ years: B.years, yhat: B.yhat, costRange });
	await sleep(EXTRA_STAGE_HOLD_MS);

	/* ----- C ----- */
	try { if (makeEnsemble) void makeEnsemble([A, B]); } catch {}

	// [추가] 차트 부제: buildingName → roadAddr → jibunAddr 우선
	const subtitleOverride = resolveChartSubtitle(document.getElementById('forecast-root'));

	// [수정] C 차트 호출 시 subtitleOverride 전달
	await renderEnergyComboChart?.({ years, series: baseForecast.series, cost: baseForecast.cost, costRange, subtitleOverride });
	await sleep(300);

	if (typeof onCComplete === 'function') onCComplete();
}

// [추가] 차트 부제 결정(빌딩명/주소 중 하나라도 있으면 사용)
function resolveChartSubtitle(rootEl) {
	if (!rootEl) return '';
	const ds = rootEl.dataset || {};
	return ds.buildingName || ds.bname || ds.roadAddr || ds.jibunAddr || '';
}

/* 이하 유틸/데이터/렌더 보조는 기존과 동일 (생략 없이 유지) */

// [수정] 안전 기본 동작: 전체 새로고침
function reloadForecast() {
	// 페이지 상태/캐시 일관성 위해 전체 리로드
	try {
		window.location.reload();
	} catch (e) {
		console.warn('[forecast] reload failed:', e);
	}
}

/* ---------- Data ---------- */
function makeDummyForecast(fromYear, toYear) {
	let from = parseInt(fromYear, 10);
	let to = parseInt(toYear, 10);
	if (!Number.isFinite(from)) from = NOW_YEAR;
	if (!Number.isFinite(to)) to = from + HORIZON_YEARS;
	if (to < from) [from, to] = [to, from];
	if (to === from) to = from + HORIZON_YEARS;

	const years = [];
	for (let y = from; y <= to; y++) years.push(String(y));
	const L = years.length;

	const baseKwh = 2_150_000;
	const afterRate = 0.03;
	const startSaving = 360_000;
	const savingRate = 0.04;
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
	let from = parseInt(String(ctx.from ?? NOW_YEAR), 10);
	let to = parseInt(String(ctx.to ?? (NOW_YEAR + HORIZON_YEARS)), 10);
	if (!Number.isFinite(from)) from = NOW_YEAR;
	if (!Number.isFinite(to)) to = from + HORIZON_YEARS;
	if (to < from) [from, to] = [to, from];
	if (to === from) to = from + HORIZON_YEARS;

	const [lo, hi] = [from, to];
	const years = range(lo, hi);

	const qs = buildCtxQuery({ ...ctx, from: lo, to: hi });

	const hasId = ctx.buildingId != null && String(ctx.buildingId).trim() !== '';
	const base = hasId ? `/api/forecast/${encodeURIComponent(String(ctx.buildingId))}` : `/api/forecast`;
	const url = `${base}?${qs}`;

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
	const years = Array.isArray(d?.years) ? d.years.map(String) : fallbackYears.map(String);
	const L = years.length;

	// [수정] 0 채움 대신 Forward-fill 적용
	const after  = toNumArrFFill(d?.series?.after,  L);
	const saving = toNumArrFFill(d?.series?.saving, L);
	const cost   = { saving: toNumArrFFill(d?.cost?.saving, L) };
	const kpi    = d?.kpi ?? null;

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

function updateMetaPanel({ years, model, features }) {
	const fromY = Number(years?.[0]);
	const toY = Number(years?.[years?.length - 1]);

	const rangeEl = document.getElementById('meta-data-range');
	if (rangeEl) {
		let text = '-';
		if (Number.isFinite(fromY) && Number.isFinite(toY)) {
			text = (fromY === toY) ? `${fromY}년` : `${fromY}~${toY} 연간`;
		}
		rangeEl.textContent = text;
	}

	const modelEl = document.getElementById('meta-model');
	if (modelEl && model) modelEl.textContent = model;

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

function renderSummary({ gradeNow }) {
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

	if (b.buildingName) rows.push(row('건물명', esc(b.buildingName)));
	if (b.dongName) rows.push(row('동명', esc(b.dongName)));
	if (b.buildingIdent) rows.push(row('식별번호', esc(b.buildingIdent)));
	if (b.lotSerial) rows.push(row('지번', esc(b.lotSerial)));
	if (b.use) rows.push(row('용도', esc(b.use)));
	if (b.approvalDate) rows.push(row('사용승인일', esc(b.approvalDate)));
	if (b.area) rows.push(row('건축면적', nf(b.area) + ' m²'));
	if (b.plotArea) rows.push(row('대지면적', nf(b.plotArea) + ' m²'));
	if (b.height) rows.push(row('높이', nf(b.height) + ' m'));
	if (b.floorsAbove != null || b.floorsBelow != null) {
		rows.push(row('지상/지하', `${b.floorsAbove ?? 0} / ${b.floorsBelow ?? 0}`));
	}

	if (!rows.length) { box.classList.add('hidden'); box.innerHTML = ''; return; }

	if (b.pnu && !fromQs('pnu')) rows.push(row('PNU', esc(b.pnu)));
	if (b.builtYear && !fromQs('builtYear')) rows.push(row('준공연도', String(b.builtYear)));

	box.innerHTML = `<div class="card building-card"><h4>건물 정보</h4>${rows.join('')}</div>`;
	box.classList.remove('hidden');
}

function euiRefForGrade(grade) {
	const map = { 1: 120, 2: 160, 3: 180, 4: 200, 5: 220 };
	return map[grade] ?? 180;
}

// 누락값을 0 대신 '직전 값'으로 채우는 보정(Forward-fill)
// 첫 유효 샘플을 찾아 seed로 쓰고, 그 아래로는 최소 바닥(floor)은 사용하지 않음(순수 f-fill)
function toNumArrFFill(arr, len) {
	const out = new Array(len);
	let last = 0;

	// 첫 유효값(seed) 탐색
	if (Array.isArray(arr)) {
		for (let i = 0; i < arr.length; i++) {
			const v = Number(arr[i]);
			if (Number.isFinite(v) && v > 0) { last = v; break; }
		}
	}

	// 본 채움
	for (let i = 0; i < len; i++) {
		const raw = Array.isArray(arr) ? Number(arr[i]) : NaN;
		if (Number.isFinite(raw) && raw > 0) { out[i] = raw; last = raw; }
		else { out[i] = last; }
	}
	return out;
}


/* ---------- Helpers ---------- */
function nf(n) {
	try { return new Intl.NumberFormat('ko-KR').format(Math.round(Number(n) || 0)); }
	catch { return String(n); }
}
function range(a, b) { const arr = []; for (let y = a; y <= b; y++) arr.push(y); return arr; }
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
function $(s, root = document) { return root.querySelector(s); }
function $all(s, root = document) { return Array.from(root.querySelectorAll(s)); }
function show(el) { if (el) el.classList.remove('hidden'); }
function hide(el) { if (el) el.classList.add('hidden'); }

/* ---------- [NEW] 비용축 눈금 헬퍼 (main에서도 사용 가능) ---------- */
function getNiceStep(min, max, targetTicks = 6) {
	const range = Math.max(1, Math.abs(Number(max) - Number(min)));
	const raw = range / Math.max(1, targetTicks);
	const exp = Math.floor(Math.log10(raw));
	const base = raw / Math.pow(10, exp);
	let niceBase = (base <= 1) ? 1 : (base <= 2) ? 2 : (base <= 5) ? 5 : 10;
	return niceBase * Math.pow(10, exp);
}
function roundMinMaxToStep(min, max, step) {
	const s = Number(step) || 1;
	const nmin = Math.floor(min / s) * s;
	const nmax = Math.ceil(max / s) * s;
	return { min: nmin, max: nmax };
}


/* /forecast 빈 진입 등 컨텍스트가 전혀 없을 때의 기본값 생성 */
function fallbackDefaultContext(root) {
	const urlp = new URLSearchParams(location.search);

	let from = parseInt(urlp.get('from') || String(NOW_YEAR), 10);
	let to   = parseInt(urlp.get('to')   || String(NOW_YEAR + HORIZON_YEARS), 10);

	if (!Number.isFinite(from)) from = NOW_YEAR;
	if (!Number.isFinite(to))   to   = from + HORIZON_YEARS;
	if (to < from) [from, to] = [to, from];
	if (to === from) to = from + HORIZON_YEARS;

	let builtYear = parseInt(urlp.get('builtYear') || String(from - 13), 10);
	if (!Number.isFinite(builtYear) || builtYear <= 0) builtYear = from - 13;

	return { from: String(from), to: String(to), builtYear };
}
