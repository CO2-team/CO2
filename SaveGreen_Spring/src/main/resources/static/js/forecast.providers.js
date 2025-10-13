/* =========================================================
 * forecast.providers.js (FINAL)
 * - 단일 진입점: getBuildingContext()
 * - 소스 우선순위: page → localStorage → url → vworld  (auto 기준)
 * - builtYear=0 은 유효값으로 취급하지 않음 (양수만 허용)
 * ========================================================= */
;(function (global) {
	'use strict';

	const NOW_YEAR = new Date().getFullYear();
	const HORIZON_YEARS = 10;

	function pickStrategy() {
		const pref = (localStorage.getItem('source') || 'auto').toLowerCase();
		if (pref === 'local')   return ['local', 'page', 'url', 'vworld'];
		if (pref === 'url')     return ['url', 'page', 'local', 'vworld'];
		if (pref === 'vworld')  return ['vworld', 'page', 'local', 'url'];
		return ['page', 'local', 'url', 'vworld']; // auto
	}

	async function trySource(kind) {
		if (kind === 'page')   return readFromPage();
		if (kind === 'local')  return readFromLocalStorage();
		if (kind === 'url')    return readFromUrl();
		if (kind === 'vworld') return fetchFromVWorldProxy();
		return null;
	}

	async function getBuildingContext() {
		const order = pickStrategy();
		console.info('[provider] order =', order.join(' → '));

		for (const s of order) {
			try {
				const v = await trySource(s);
				if (isValid(v)) {
					const ctx = normalize(v);
					console.info(`[provider] hit = ${s}`, ctx);
					return ctx;
				}
				console.debug(`[provider] ${s} → empty or invalid`, v);
			} catch (e) {
				console.warn(`[provider] ${s} failed:`, e);
			}
		}
		throw new Error('No context source available (page/local/url/vworld)');
	}

	/* ------------------------ Sources ------------------------ */
	function readFromPage() {
		const root = document.getElementById('forecast-root');
		if (!root) return null;

		const o = {
			buildingId: nvPos(root.dataset.bid) ?? parseIdFromForecastPath(),
			builtYear:  nvPos(root.dataset.builtYear),            // 양수만
			useName:    sv(root.dataset.use),
			floorArea:  nv(root.dataset.floorArea),
			area:       nv(root.dataset.area),
			pnu:        sv(root.dataset.pnu),
			from:       sv(root.dataset.from) || String(NOW_YEAR),
			to:         sv(root.dataset.to)   || String(NOW_YEAR + HORIZON_YEARS),
			lat:        nv(root.dataset.lat),
			lon:        nv(root.dataset.lon)
		};
		return hasAny(o) ? o : null;
	}

	function parseIdFromForecastPath() {
		try {
			const m = String(location.pathname).match(/^\/forecast\/(\d+)(?:\/)?$/);
			return m ? Number(m[1]) : undefined;
		} catch { return undefined; }
	}

	function readFromLocalStorage() {
		const raw = localStorage.getItem('forecast.ctx');
		if (!raw) return null;
		try {
			const o = JSON.parse(raw);
			// builtYear=0 정리
			if (o && Number(o.builtYear) === 0) delete o.builtYear;
			return hasAny(o) ? o : null;
		} catch (e) {
			console.warn('[provider] forecast.ctx JSON parse error:', e);
			return null;
		}
	}

	function readFromUrl() {
		try {
			const q = new URLSearchParams(location.search);
			const o = {
				buildingId: nvPos(q.get('bid')) ?? nvPos(q.get('id')),
				builtYear:  nvPos(q.get('builtYear')),              // 양수만
				useName:    sv(q.get('useName') || q.get('use')),
				floorArea:  nv(q.get('floorArea')),
				area:       nv(q.get('area')),
				pnu:        sv(q.get('pnu')),
				from:       sv(q.get('from')) || String(NOW_YEAR),
				to:         sv(q.get('to'))   || String(NOW_YEAR + HORIZON_YEARS),
				lat:        nv(q.get('lat')),
				lon:        nv(q.get('lon'))
			};
			return hasAny(o) ? o : null;
		} catch { return null; }
	}

	// 서버 프록시 경유 (/api/ext/vworld/*)
	async function fetchFromVWorldProxy() {
		const seed = readFromPage() || readFromLocalStorage() || readFromUrl();
		if (!seed) return null;

		const pnu = seed.pnu && String(seed.pnu).trim();
		const lat = isFiniteNum(seed.lat) ? Number(seed.lat) : undefined;
		const lon = isFiniteNum(seed.lon) ? Number(seed.lon) : undefined;

		let url = null;
		if (pnu) url = `/api/ext/vworld/parcel?pnu=${encodeURIComponent(pnu)}`;
		else if (lat != null && lon != null) url = `/api/ext/vworld/revgeo?lat=${lat}&lon=${lon}`;
		else return null;

		console.debug('[provider] vworld GET', url);
		const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
		if (!res.ok) throw new Error(`VWorld ${res.status}`);

		const v = await res.json();
		return { ...seed, ...v };
	}

	/* ------------------------ Helpers ------------------------ */
	function isValid(v) {
		if (!v) return false;
		const hasFT = nonEmpty(v.from) && nonEmpty(v.to);
		const hasKey =
			(nvPos(v.builtYear) !== undefined) ||      // 양수만 유효
			(nvPos(v.buildingId) !== undefined) ||
			nonEmpty(v.pnu) ||
			isFiniteNum(v.lat) || isFiniteNum(v.lon);
		return !!(hasFT && hasKey);
	}

	function normalize(v) {
		const by = nvPos(v.builtYear);
		return {
			buildingId: nvPos(v.buildingId),
			builtYear:  by,
			useName:    v.useName ?? v.use_name ?? undefined,
			floorArea:  nv(v.floorArea) ?? nv(v.area)),
			area:       nv(v.area),
			pnu:        sv(v.pnu),
			from:       String(v.from ?? NOW_YEAR),
			to:         String(v.to   ?? (NOW_YEAR + HORIZON_YEARS)),
			lat:        isFiniteNum(v.lat) ? Number(v.lat) : undefined,
			lon:        isFiniteNum(v.lon) ? Number(v.lon) : undefined
		};
	}

	function nv(x) {
		if (x == null) return undefined;
		const s = String(x).trim();
		if (s === '') return undefined;
		const n = Number(s);
		return Number.isFinite(n) ? n : undefined;
	}
	function nvPos(x) {
		const n = nv(x);
		return (Number.isFinite(n) && n > 0) ? n : undefined; // 양수만
	}
	function sv(x) {
		if (x == null) return undefined;
		const s = String(x).trim();
		return s ? s : undefined;
	}
	function nonEmpty(x) { return x != null && String(x).trim() !== ''; }
	function isFiniteNum(x) { const n = Number(x); return Number.isFinite(n); }
	function hasAny(o) { return !!(o && Object.values(o).some(v => v != null && String(v) !== '')); }

	/* ------------------------ Expose ------------------------ */
	global.getBuildingContext = getBuildingContext;
	if (typeof window !== 'undefined') {
		window.SG = window.SG || {};
		window.SG.providers = { getBuildingContext };
	}
	if (typeof exports === 'object' && typeof module !== 'undefined') {
		module.exports = { getBuildingContext };
	}
})(window);
