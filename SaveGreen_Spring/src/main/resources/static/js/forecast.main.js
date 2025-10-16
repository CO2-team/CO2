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
	const menubar = document.getElementById('menubar');	// header.html 내부 id 예상
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

/* ==========================================================
 * 로딩 정보패널 & 시작 버튼(있으면 클릭/없으면 자동) — ★이번 패치 핵심★
 * ========================================================== */

/** 상태: idle(시작전)/running(로딩중)/complete(완료) → 진행바 명도/상태문 변경 */
function setPreloadState(state) {
	document.body.classList.remove('is-idle','is-running','is-complete');
	document.body.classList.add(`is-${state}`);
	const el = document.getElementById('preload-status');
	if (!el) return;
	const MAP = {
		idle: '대기 중 · 시작 버튼을 눌러 예측을 시작하세요',
		running: '연산 중… 잠시만 기다려주세요.',
		complete: '완료'
	};
	el.textContent = MAP[state] || '';
}

/** ① 건물 컨텍스트 + ② 예측 가정(2줄) + ④ 리스크 배지 채우기 */
function renderPreloadInfoAndRisks() {
	// 루트 엘리먼트 & 데이터 소스 헬퍼
	const root = document.getElementById('forecast-root');
	if (!root) return;
	const ds   = root.dataset || {};
	const ls   = (k) => localStorage.getItem('forecast.' + k) || '';
	const pick = (k) => (ds[k] || ls(k) || '').toString().trim();
	const numOk = (v) => v !== '' && !isNaN(parseFloat(v));

	/* -------------------------------------------------------
	 * ① 건물 컨텍스트 카드
	 *  - 값이 없으면 해당 li는 감춤(display:none)
	 * ----------------------------------------------------- */
	const bmap = {
		buildingName: pick('buildingName') || ds.bname || '',
		roadAddr:     pick('roadAddr') || pick('jibunAddr') || '',
		useName:      pick('use') || pick('useName') || '',
		builtYear:    pick('builtYear') || '',
		floorArea:    pick('area') || pick('floorArea') || '',
		pnu:          pick('pnu') || ''
	};
	const box = document.getElementById('preload-building');
	if (box) {
		box.querySelectorAll('li[data-k]').forEach((li) => {
			const key = li.getAttribute('data-k');
			let val = bmap[key] || '';
			// 면적 표기 보정(숫자면 천단위 + 단위)
			if (key === 'floorArea' && val) {
				const n = Number(String(val).replace(/,/g, ''));
				if (!isNaN(n)) val = n.toLocaleString('ko-KR') + ' ㎡';
			}
			if (!val) {
				li.style.display = 'none';
			} else {
				const vEl = li.querySelector('.v');
				if (vEl) vEl.textContent = val;
				li.style.display = '';
			}
		});
	}

	/* -------------------------------------------------------
	 * ② 예측 가정(2줄)
	 *  - 1줄: 전력단가 · 상승률 · 할인율
	 *  - 2줄: (우선) 배출계수 · 효율개선  / (대안) 요금제 · 가동률
	 *    -> 값이 없으면 해당 줄은 자동 숨김
	 * ----------------------------------------------------- */
	// 1줄
	{
		const unit        = pick('unitPrice') || '기본';                 // 원/kWh 또는 '기본'
		const escalatePct = pick('tariffEscalationPct');                 // %
		const discountPct = pick('discountRatePct');                     // %

		const unitText = (unit === '기본') ? '기본(가정)' : `${unit}원/kWh`;
		const parts = [`전력단가: ${unitText}`];
		if (numOk(escalatePct)) parts.push(`상승률: ${parseFloat(escalatePct)}%/년`);
		if (numOk(discountPct)) parts.push(`혈인율: ${parseFloat(discountPct)}%/년`.replace('혈', '할')); // 오타 방지용

		const line1 = parts.join(' · ');
		const el1 = document.getElementById('assumption-line-1');
		if (el1) { el1.textContent = line1; el1.style.display = line1 ? '' : 'none'; }
	}

	// 2줄
	{
		const co2Factor   = pick('co2Factor');           // kgCO₂/kWh
		const effGainPct  = pick('efficiencyGainPct');   // %
		const tariffType  = pick('tariffType');          // 텍스트
		const utilPct     = pick('utilizationPct');      // %

		let parts2 = [];
		if (co2Factor || effGainPct) {
			// 우선안: 배출계수 · 효율개선
			if (co2Factor) parts2.push(`배출계수: ${co2Factor} kgCO₂/kWh`);
			if (numOk(effGainPct)) parts2.push(`효율 개선: ${parseFloat(effGainPct)}%`);
		} else if (tariffType || numOk(utilPct)) {
			// 대안: 요금제 · 가동률
			if (tariffType) parts2.push(`요금제: ${tariffType}`);
			if (numOk(utilPct)) parts2.push(`가동률: ${parseFloat(utilPct)}%`);
		}

		const line2 = parts2.join(' · ');
		const el2 = document.getElementById('assumption-line-2');
		if (el2) { el2.textContent = line2; el2.style.display = line2 ? '' : 'none'; }
	}

	/* -------------------------------------------------------
	 * ④ 리스크 배지
	 *  - 노후(20년↑), 면적 소형, 용도 미지정 간단 규칙
	 * ----------------------------------------------------- */
	{
		const wrap = document.getElementById('risk-badges');
		if (wrap) {
			wrap.innerHTML = '';
			const badges = [];
			const nowY = (typeof NOW_YEAR !== 'undefined') ? NOW_YEAR : new Date().getFullYear();

			const by = parseInt(pick('builtYear'), 10);
			if (Number.isFinite(by) && nowY - by >= 20) badges.push({ t: '노후 리스크 ↑', c: 'warn' });

			const area = parseFloat(pick('area') || pick('floorArea'));
			if (Number.isFinite(area) && area > 0 && area < 500) badges.push({ t: '표본 작음', c: 'muted' });

			const useName = pick('use') || pick('useName');
			if (!useName) badges.push({ t: '용도 미지정', c: 'info' });

			badges.slice(0, 3).forEach(b => {
				const el = document.createElement('span');
				el.className = `badge ${b.c}`;
				el.textContent = b.t;
				wrap.appendChild(el);
			});
		}
	}
}


/** 버튼 있으면 클릭으로 시작, 없으면 자동 시작(하위호환) */
function wireStartButtonAndFallback() {
	const btn = document.getElementById('forecast-start');

	// 시작 전 상태 + 정보 패널 채움
	setPreloadState('idle');
	renderPreloadInfoAndRisks();

	if (btn) {
		btn.addEventListener('click', () => {
			setPreloadState('running');		// 게이지 진행 직전
			runForecast().catch(e => console.error('[forecast] run failed:', e));
		});
	} else {
		// 버튼이 없는 페이지는 기존처럼 자동 시작
		setPreloadState('running');
		runForecast().catch(e => console.error('[forecast] run failed:', e));
	}
}

/* ---------- 초기화 ---------- */
async function init() {
	initHeaderOffset();

	const root = document.getElementById('forecast-root');

	// Forecast 컨텍스트: localStorage 키 표준(읽기 전용)
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

	// localStorage → dataset 부트스트랩(그린 파인더가 저장해 준 값을 Forecast에서 소비)
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

		// 건물명: 기존 키(bname)와 신규 키(buildingName) 모두 대응
		if (ctx.buildingName) {
			if (!rootEl.dataset.bname) rootEl.dataset.bname = ctx.buildingName;
			if (!rootEl.dataset.buildingName) rootEl.dataset.buildingName = ctx.buildingName;
		}
		if (ctx.roadAddr && !rootEl.dataset.roadAddr) rootEl.dataset.roadAddr = ctx.roadAddr;
		if (ctx.jibunAddr && !rootEl.dataset.jibunAddr) rootEl.dataset.jibunAddr = ctx.jibunAddr;
		if (ctx.lat && !rootEl.dataset.lat) rootEl.dataset.lat = ctx.lat;
		if (ctx.lon && !rootEl.dataset.lon) rootEl.dataset.lon = ctx.lon;

		try {
			console.log('[forecast] ctx from storage →', {
				pnu: ctx.pnu, builtYear: ctx.builtYear, floorArea: ctx.floorArea,
				useName: ctx.useName, buildingName: ctx.buildingName
			});
		} catch {}
	}

	// 1) 스토리지 기반 컨텍스트 부트스트랩
	bootstrapContextFromStorage(root);

	// 2) 주소창 → data-* Fallback 주입
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

	// 3) 페이지 상단의 빌딩 카드(결과 섹션 아님) 렌더
	renderBuildingCard();

	// 4) [변경 포인트] 여기서 바로 예측 실행하지 않고, 버튼/폴백으로 실행시킴
	//		- 진행 전에도 정보 패널을 노출하고, 시작 버튼 또는 폴백에서 runForecast() 호출
	wireStartButtonAndFallback();

    primeMetaRangeFromDataset();   // 상단 '데이터' 칩에 2025–2035 같은 기간 표시

}

/* ==========================================================
 * 실제 예측 시퀀스(기존 init 실행 파트 그대로)
 *  - 로더 시작 → 컨텍스트 확보 → 데이터 로드/보정 → 메타패널 업데이트
 *  - KPI/상태 판정 → 로더 종료 → ABC 차트 시퀀스 → 결과 요약 렌더
 * ========================================================== */
async function runForecast() {
	const $result = $('#result-section');
	const $ml = $('#mlLoader');
	const $surface = $('.result-surface');	// KPI/요약/배너 래퍼

	// 로더 시작
	show($ml);
	hide($result);
	startLoader();

	/* 컨텍스트 확보 (실패 시 더미로 폴백) */
	let ctx, useDummy = false;
	const root = document.getElementById('forecast-root');
	try {
		// NOTE: 팀에서 이미 제공하던 체인(page → local → url → vworld)을 그대로 사용
		ctx = await getBuildingContext();
		console.info('[forecast] ctx =', ctx);
	} catch (e) {
		console.warn('[forecast] no context → fallback to dummy', e);
		ctx = fallbackDefaultContext(root);
		useDummy = true;
	}

	// 데이터 로드
	const data = useDummy ? makeDummyForecast(ctx.from, ctx.to) : await fetchForecast(ctx);
	window.FORECAST_DATA = data;

	// 길이/타입 강제 정렬 + 누락 보정(Forward-fill)
	{
		const expectedYears = Array.isArray(data.years) ? data.years.map(String) : [];
		const L = expectedYears.length;

		data.years = expectedYears;
		data.series = data.series || {};
		data.cost = data.cost || {};

		data.series.after	= toNumArrFFill(data.series.after,	L);
		data.series.saving	= toNumArrFFill(data.series.saving,	L);
		data.cost.saving	= toNumArrFFill(data.cost.saving,	L);
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

	// 로더 종료(시각적으로 100%까지 보이도록 최소 시간 보장 후 종료)
	await ensureMinLoaderTime();
	await finishLoader();
	hide($ml);
	show($result);
	if ($surface) hide($surface);

	// ABC 순차 실행
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

	// 완료 상태(필요하면 상단 패널 페이드아웃 등 후처리 가능)
	setPreloadState('complete');
}

// rAF 보조
function $requestAnimationFramePoly(cb) {
	if (window.requestAnimationFrame) return window.requestAnimationFrame(cb);
	return setTimeout(cb, 16);
}

/* ==========================================================
 * ABC 직렬 시퀀스 (기존 렌더러 호출 유지)
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
	const renderEnergyComboChart = typeof F.renderEnergyComboChart === 'function'
		? F.renderEnergyComboChart : (window.renderEnergyComboChart || undefined);

	const calcChartAnimMs = typeof F.calcChartAnimMs === 'function'
		? F.calcChartAnimMs : (() => (n * (600 + 120) + 200 + n * (240 + 90) + 50)); // 안전 기본값

	// 단계 사이에 추가 머무는 시간(리뷰 요청: 2~3초)
	const EXTRA_STAGE_HOLD_MS = 3000;

	/* ----- 비용축 범위(모든 단계 공통) ----- */
	const costArr = Array.isArray(baseForecast?.cost?.saving) ? baseForecast.cost.saving.slice(0, n) : [];
	let cmax = -Infinity;
	for (const v of costArr) {
		const x = Number(v);
		if (Number.isFinite(x) && x > cmax) cmax = x;
	}
	if (!Number.isFinite(cmax)) cmax = 1;
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
	await renderModelAChart?.({ years: A.years, yhat: A.yhat, costRange });
	await sleep(EXTRA_STAGE_HOLD_MS);

	/* ----- B ----- */
	const B = modelOrFallback('B');
	await renderModelBChart?.({ years: B.years, yhat: B.yhat, costRange });
	await sleep(EXTRA_STAGE_HOLD_MS);

	/* ----- C ----- */
	try { if (makeEnsemble) void makeEnsemble([A, B]); } catch {}

	// 차트 부제: buildingName → roadAddr → jibunAddr 우선
	const subtitleOverride = resolveChartSubtitle(document.getElementById('forecast-root'));

	await renderEnergyComboChart?.({
		years,
		series: baseForecast.series,
		cost: baseForecast.cost,
		costRange,
		subtitleOverride
	});
	await sleep(300);

	if (typeof onCComplete === 'function') onCComplete();
}

// 차트 부제 결정(빌딩명/주소 중 하나라도 있으면 사용)
function resolveChartSubtitle(rootEl) {
	if (!rootEl) return '';
	const ds = rootEl.dataset || {};
	return ds.buildingName || ds.bname || ds.roadAddr || ds.jibunAddr || '';
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

	// Forward-fill 보정
	const after	= toNumArrFFill(d?.series?.after,	L);
	const saving = toNumArrFFill(d?.series?.saving, L);
	const cost	= { saving: toNumArrFFill(d?.cost?.saving, L) };
	const kpi	= d?.kpi ?? null;

	return { years, series: { after, saving }, cost, kpi };
}

/* ---------- KPI/요약/상태 ---------- */
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
	const modelEl = document.getElementById('modelName');
	if (modelEl && model) modelEl.textContent = model;
	const featEl = document.getElementById('meta-features');
	if (featEl && Array.isArray(features) && features.length) featEl.textContent = features.join(', ');
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
	const esc = (t) => String(t).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
	if (b.buildingName) rows.push(row('건물명', esc(b.buildingName)));
	if (b.dongName) rows.push(row('동명', esc(b.dongName)));
	if (b.buildingIdent) rows.push(row('식별번호', esc(b.buildingIdent)));
	if (b.lotSerial) rows.push(row('지번', esc(b.lotSerial)));
	if (b.use) rows.push(row('용도', esc(b.use)));
	if (b.approvalDate) rows.push(row('사용승인일', esc(b.approvalDate)));
	if (b.area) rows.push(row('건축면적', nf(b.area) + ' m²'));
	if (b.plotArea) rows.push(row('대지면적', nf(b.plotArea) + ' m²'));
	if (b.height) rows.push(row('높이', nf(b.height) + ' m'));
	if (b.floorsAbove != null || b.floorsBelow != null) rows.push(row('지상/지하', `${b.floorsAbove ?? 0} / ${b.floorsBelow ?? 0}`));
	if (!rows.length) { box.classList.add('hidden'); box.innerHTML = ''; return; }
	if (b.pnu && !fromQs('pnu')) rows.push(row('PNU', esc(b.pnu)));
	if (b.builtYear && !fromQs('builtYear')) rows.push(row('준공연도', String(b.builtYear)));
	box.innerHTML = `<div class="card building-card"><h4>건물 정보</h4>${rows.join('')}</div>`;
	box.classList.remove('hidden');
}

/* ---------- 유틸 ---------- */
function euiRefForGrade(grade) {
	const map = { 1: 120, 2: 160, 3: 180, 4: 200, 5: 220 };
	return map[grade] ?? 180;
}

// 누락값을 0 대신 직전값으로 채우는 보정(Forward-fill)
function toNumArrFFill(arr, len) {
	const out = new Array(len);
	let last = 0;
	if (Array.isArray(arr)) {
		for (let i = 0; i < arr.length; i++) {
			const v = Number(arr[i]);
			if (Number.isFinite(v) && v > 0) { last = v; break; }
		}
	}
	for (let i = 0; i < len; i++) {
		const raw = Array.isArray(arr) ? Number(arr[i]) : NaN;
		if (Number.isFinite(raw) && raw > 0) { out[i] = raw; last = raw; }
		else { out[i] = last; }
	}
	return out;
}

function primeMetaRangeFromDataset() {
	const root = document.getElementById('forecast-root');
	if (!root) return;
	const from = root.dataset.from || new Date().getFullYear();
	const to   = root.dataset.to   || (new Date().getFullYear() + 10);
	const el = document.getElementById('meta-data-range');
	if (el) el.textContent = (String(from) === String(to)) ? `${from}년` : `${from}–${to}`;
}

/* ---------- Helpers ---------- */
function nf(n) { try { return new Intl.NumberFormat('ko-KR').format(Math.round(Number(n) || 0)); } catch { return String(n); } }
function range(a, b) { const arr = []; for (let y = a; y <= b; y++) arr.push(y); return arr; }
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
function $(s, root = document) { return root.querySelector(s); }
function $all(s, root = document) { return Array.from(root.querySelectorAll(s)); }
function show(el) { if (el) el.classList.remove('hidden'); }
function hide(el) { if (el) el.classList.add('hidden'); }

/* 비용축 눈금 헬퍼 */
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

/* ---------- 기존 프로젝트 제공 함수(호출만 사용) ----------
 * - getBuildingContext(), computeKpis(), decideStatusByScore(),
 *   startLoader(), ensureMinLoaderTime(), finishLoader(),
 *   SaveGreen.Forecast.renderModelAChart/BChart/calcChartAnimMs/makeEnsemble 등
 *   : 본 파일에서는 "호출"만 하며, 구현은 기존 코드/다른 파일에 있음.
 * --------------------------------------------------------- */
