/* =========================================================
 * forecast.providers.js (FINAL)
 * - 단일 진입점: getBuildingContext()
 * - 소스 우선순위: page → localStorage → url → vworld  (auto 기준)
 * - builtYear=0 은 유효값으로 취급하지 않음 (양수만 허용)
 *
 * [개요]
 * 이 모듈은 Forecast 페이지가 시작될 때 "건물 컨텍스트( buildingId, builtYear, pnu, 좌표, 기간 등 )"를
 * 일관된 구조로 수집/정규화하는 단일 진입점을 제공합니다.
 *
 * [동작 흐름]
 * 1) pickStrategy()로 소스 우선순위를 결정(sessionStorage/localStorage의 'source' 키로 강제 가능: 'local'|'url'|'vworld')
 * 2) trySource(kind)로 각 소스를 순서대로 조회(page/local/url/vworld)
 * 3) isValid()로 최소 유효성 검사(기간 from/to, 식별자/좌표/연도 등 핵심 키 보유 여부)
 * 4) normalize()로 숫자/문자 필드 표준화
 *
 * [필드 설명(정규화 결과)]
 * - buildingId: 숫자 또는 undefined
 * - builtYear : 양수(정수) 또는 undefined (0은 허용하지 않음)
 * - useName   : 용도명 (문자열) 또는 undefined
 * - floorArea : 연면적 등 (숫자) 또는 undefined
 * - area      : 면적(보조) (숫자) 또는 undefined
 * - pnu       : 지번 고유 식별자(문자열) 또는 undefined
 * - from/to   : 예측 구간 (문자열) — 기본값: 현재연도 ~ 현재연도+10
 * - lat/lon   : 좌표(숫자) 또는 undefined
 *
 * [주의]
 * - sessionStorage에 GreenFinder가 심어놓은 값이 있을 수 있으며(readFromLocal에서 sniffSessionForBuilding로 병합)
 * - /api/ext/vworld/* 프록시를 통해 도로명/지번/건물명 보강(enrichContext) 가능
 * - 이 파일은 “컨텍스트 수집/정규화”에 집중하며, 이후 단계(로더/차트/KPI)는 별도 모듈에서 처리
 * ========================================================= */

;(function (global) {
	'use strict';

	/* ---------- 상수 ---------- */
	// 현재 연도 + 예측 수평선(디폴트 10년)을 from/to 기본값으로 사용합니다.
	const NOW_YEAR = new Date().getFullYear();
	const HORIZON_YEARS = 10;

	/* ---------- 공용 스토리지 헬퍼 (세션 우선, 로컬 폴백) ---------- */
	/**
	 * storageGet(key)
	 * - 목적: 같은 키를 sessionStorage에서 우선 조회하고, 없으면 localStorage에서 조회합니다.
	 * - 배경: GreenFinder가 sessionStorage 중심으로 동작하므로 탭/세션 단위 격리를 우선시합니다.
	 */
	function storageGet(key) {
		try {
			const v = sessionStorage.getItem(key);
			if (v !== null && v !== undefined) return v;
		} catch {}
		try {
			return localStorage.getItem(key);
		} catch {}
		return null;
	}

	/* ---------- GreenFinder 세션 스니핑 ---------- */
	/**
	 * sniffSessionForBuilding()
	 * - 목적: GreenFinder(선행 검색 화면)에서 sessionStorage에 남긴 정보를 포착해 Forecast로 전달.
	 * - 출력: { pnu, jibunAddr, lat, lon, buildingName, from, to } 또는 null
	 * - 비고: 값이 하나라도 있으면 객체를 반환합니다(컨텍스트 보강의 씨앗 역할).
	 */
	// [NEW] GreenFinder → sessionStorage 스니핑
	function sniffSessionForBuilding() {
    	try {
    		// 그린파인더가 남기는 키들(스샷 기준)
    		const get = (k) => (sessionStorage.getItem(k) || '').toString().trim();

    		const ldCodeNm = get('ldCodeNm');      // 예: '대전광역시 서구 둔산동'
    		const mnnmSlno = get('mnnmSlno');      // 예: '1268'
    		const pnu      = get('pnu');           // 예: '3017011200112680000'
    		const latStr   = get('lat');           // 위도(문자열)
    		// [수정] 경도는 lon/lng 둘 다 수용
    		const lonRaw   = get('lon') || get('lng');
    		const buildingName = get('buildingName') || get('buldNm') || '';

    		// ✨ [추가] 사용승인일/연식 스니핑(세션 "읽기 전용")
    		const useConfmDe = get('useConfmDe'); // 예: '1996-12-05' (없어도 무관)
    		const builtYearRaw = get('builtYear'); // 예: '1996' (없으면 빈 문자열)
    		// 🧩 [추가] 연식 계산: builtYear가 있으면 우선 사용, 없으면 useConfmDe 앞 4자리
    		const builtYear = (() => {
    			if (/^\d{4}$/.test(builtYearRaw)) return builtYearRaw;
    			if (/^\d{4}/.test(useConfmDe)) return useConfmDe.slice(0, 4);
    			return '';
    		})();

    		// 지번주소 조립(둘 다 있을 때만)
    		const jibunAddr = (ldCodeNm && mnnmSlno) ? `${ldCodeNm} ${mnnmSlno}` : '';

    		// 숫자 파싱(NaN 방지)
    		const latNum = Number(latStr);
    		const lonNum = Number(lonRaw);

    		const o = {
    			// 표준 필드로 정규화
    			pnu: pnu || undefined,
    			jibunAddr: jibunAddr || undefined,
    			lat: Number.isFinite(latNum) ? latNum : undefined,
    			lon: Number.isFinite(lonNum) ? lonNum : undefined,
    			buildingName: buildingName || undefined,

    			// ✨ [추가] 연식/사용승인일 주입(있을 때만)
    			builtYear: builtYear || undefined,
    			useConfmDe: useConfmDe || undefined,

    			// from/to는 isValid()에서 필요하므로 기본값 제공
    			from: String(NOW_YEAR),
    			to: String(NOW_YEAR + HORIZON_YEARS)
    		};

    		// 하나라도 있으면 반환
    		return Object.values(o).some(v => v != null && String(v).trim() !== '') ? o : null;
    	} catch (e) {
    		console.warn('[provider] sniffSessionForBuilding error:', e);
    		return null;
    	}
    }


	/* ---------- 컨텍스트 보강(도로명/지번/건물명) ---------- */
	/**
	 * enrichContext(ctx)
	 * - 목적: 좌표(lon/lat)나 pnu만 있는 경우, 서버 프록시(/api/ext/vworld/*)를 통해
	 *         도로명/지번 주소 및 건물명을 "보강"합니다.
	 * - 입력: { lon, lat, pnu, roadAddr?, jibunAddr?, buildingName? }
	 * - 출력: 입력 ctx를 바탕으로 가능한 필드를 채워 넣은 새 객체
	 * - 네트워크 실패시: 경고 로그만 남기고 조용히 넘어갑니다(UX 차단 방지).
	 */
	// [추가]
	// VWorld 주소/건물명 보강: lon/lat → 도로명/지번, pnu → 건물명
	async function enrichContext(ctx) {
		// 방어 복사(원본 불변 보장)
		const out = { ...ctx };

		try {
			// 1) 도로명 주소 보강: lon/lat이 있고 roadAddr이 비어 있으면 조회
			if (!out.roadAddr && out.lon != null && out.lat != null) {
				// [수정] 기존 /address → 우리 프로젝트의 /revgeo로 교체
				const url = `/api/ext/vworld/revgeo?lat=${encodeURIComponent(out.lat)}&lon=${encodeURIComponent(out.lon)}`;
				const r = await fetch(url, { headers: { 'Accept': 'application/json' } });
				if (r.ok) {
					const j = await r.json();
					// [수정] 응답 키 매핑(프로젝트 프록시 스펙 기준, 다양한 키 방어)
					out.roadAddr  = out.roadAddr  || j.roadAddr   || j.roadAddress   || j.road_name || j.road || '';
					out.jibunAddr = out.jibunAddr || j.jibunAddr  || j.parcelAddress || j.parcel    || j.jibun || '';
				}
			}

			// 2) 건물명 보강: pnu가 있고 buildingName이 비어 있으면 조회
			if (!out.buildingName && out.pnu) {
				// 기존 vworld client가 있다면 getBuildingInfo(pnu) 사용
				// [수정] 우리 프로젝트의 /parcel 프록시 사용
				try {
					const r2 = await fetch(`/api/ext/vworld/parcel?pnu=${encodeURIComponent(out.pnu)}`, { headers: { 'Accept': 'application/json' } });
					if (r2.ok) {
						const j2 = await r2.json();
						// [수정] 응답의 건물명 키들 방어적으로 매핑
						out.buildingName = j2?.buldNm || j2?.buildingName || j2?.buld_name || out.buildingName;
					}
				} catch (e2) {
					console.warn('[provider] buildingName fetch skipped:', e2);
				}
			}
		} catch (e) {
			console.warn('[provider] enrichContext error:', e);
		}

		return out;
	}

	// 네임스페이스로 보강 API 노출(디버깅/수동 보강에 유용)
	window.SaveGreen = window.SaveGreen || {};
	window.SaveGreen.Forecast = window.SaveGreen.Forecast || {};
	window.SaveGreen.Forecast.providers = window.SaveGreen.Forecast.providers || {};
	window.SaveGreen.Forecast.providers.enrichContext = enrichContext;

	/* ---------- 소스 우선순위 결정 ---------- */
	/**
	 * pickStrategy()
	 * - 목적: 컨텍스트 소스 우선순위를 결정합니다.
	 * - 방법: session/local의 'source' 값으로 강제 가능 ('local'|'url'|'vworld'), 없으면 'auto'
	 * - 결과: ['page','local','url','vworld'] 등의 배열
	 */
	function pickStrategy() {
		const pref = (storageGet('source') || 'auto').toLowerCase();
		if (pref === 'local')   return ['local', 'page', 'url', 'vworld'];
		if (pref === 'url')     return ['url', 'page', 'local', 'vworld'];
		if (pref === 'vworld')  return ['vworld', 'page', 'local', 'url'];
		return ['page', 'local', 'url', 'vworld']; // auto
	}

	/* ---------- 소스 시도기 ---------- */
	/**
	 * trySource(kind)
	 * - 목적: 전달된 kind에 따라 대응 소스를 조회
	 * - kind: 'page' | 'local' | 'url' | 'vworld'
	 * - 주의: vworld는 서버 프록시 호출(네트워크) — seed(최소 pnu 또는 좌표)가 없으면 null
	 */
	async function trySource(kind) {
		if (kind === 'page')   return readFromPage();
		if (kind === 'local')  return readFromLocal();
		if (kind === 'url')    return readFromUrl();
		if (kind === 'vworld') return fetchFromVWorldProxy();
		return null;
	}

	/* ---------- 단일 진입점 ---------- */
	/**
	 * getBuildingContext()
	 * - 목적: 우선순위에 따라 소스를 조회하고, 최초로 유효한 컨텍스트를 정규화하여 반환합니다.
	 * - 반환: normalize()된 컨텍스트 객체
	 * - 실패: 어떤 소스에서도 유효한 컨텍스트를 얻지 못하면 예외를 던집니다.
	 * - 로깅: 어떤 소스에서 hit 되었는지 info 로그로 남깁니다.
	 */
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
	/**
	 * readFromPage()
	 * - 목적: 서버가 템플릿에 심어준 data-* 속성(#forecast-root)을 읽어 컨텍스트를 구성합니다.
	 * - 장점: 서버 사이드에서 이미 알고 있는 값(정규화 완료된 값)을 그대로 전달받을 수 있음.
	 */
	function readFromPage() {
		const root = document.getElementById('forecast-root');
		if (!root) return null;

		const o = {
			buildingId: nvPos(root.dataset.bid) ?? parseIdFromForecastPath(),
			builtYear:  nvPos(root.dataset.builtYear),			// 양수만
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

	/**
	 * parseIdFromForecastPath()
	 * - 목적: /forecast/{id} 형태의 URL에서 {id}를 추출해 buildingId 후보로 사용
	 * - 비고: 템플릿 data-bid가 없을 때 보조 수단
	 */
	function parseIdFromForecastPath() {
		try {
			const m = String(location.pathname).match(/^\/forecast\/(\d+)(?:\/)?$/);
			return m ? Number(m[1]) : undefined;
		} catch { return undefined; }
	}

	/**
	 * readFromLocal()
	 * - 목적: session/local에 저장된 컨텍스트 스냅샷(JSON)과 GreenFinder 세션 스니핑을 병합
	 * - 규칙: 스냅샷(JSON, readFromLocalStorage)가 세션 스니핑 값보다 우선
	 * - 보강: from/to가 없으면 NOW_YEAR ~ NOW_YEAR+10으로 채움
	 */
	// [NEW] local 통합: localStorage 우선 + session 스니핑 보조
	function readFromLocal() {
		const a = readFromLocalStorage() || {};		// 기존 표준 컨텍스트(있으면 최우선)
		const b = sniffSessionForBuilding() || {};	// GreenFinder 세션 스니핑

		// 병합 규칙: 저장 스냅샷(a)이 세션(b)보다 우선
		const merged = { ...b, ...a };

		// from/to 기본값 보강(없으면 NOW_YEAR~NOW_YEAR+10)
		if (!merged.from) merged.from = String(NOW_YEAR);
		if (!merged.to)   merged.to   = String(NOW_YEAR + HORIZON_YEARS);

		return Object.values(merged).some(v => v != null && String(v).trim() !== '')
			? merged
			: null;
	}

	/**
	 * readFromLocalStorage()
	 * - 목적: (세션 우선, 로컬 폴백으로) 'forecast.ctx' JSON을 파싱해 컨텍스트 구성
	 * - 주의: builtYear===0은 무효로 간주(삭제)
	 * - 실패: 파싱 오류 시 경고 로그 후 null 반환
	 */
	function readFromLocalStorage() {
		const raw = storageGet('forecast.ctx'); // 세션 우선, 없으면 로컬 폴백
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

	/**
	 * readFromUrl()
	 * - 목적: 쿼리스트링으로 컨텍스트를 전달받는 경우 처리
	 * - 예시: /forecast?builtYear=1999&pnu=...&lat=...&lon=...&from=2024&to=2034
	 * - 기본: from/to가 없으면 NOW_YEAR~NOW_YEAR+10
	 */
	function readFromUrl() {
		try {
			const q = new URLSearchParams(location.search);
			const o = {
				buildingId: nvPos(q.get('bid')) ?? nvPos(q.get('id')),
				builtYear:  nvPos(q.get('builtYear')),				// 양수만
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

	/**
	 * fetchFromVWorldProxy()
	 * - 목적: seed(페이지/로컬/URL 중 하나로부터 얻은 최소 정보)를 바탕으로
	 *         서버 프록시(/api/ext/vworld/*)를 호출하여 컨텍스트를 보강합니다.
	 * - seed 필요조건: pnu 또는 (lat, lon) 중 하나 이상이 있어야 함
	 * - 동작:
	 *   - pnu가 있으면 /parcel?pnu=... 로 상세(건물명 등)
	 *   - 없고 좌표가 있으면 /revgeo?lat=...&lon=... 로 역지오코딩(도로명/지번)
	 */
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

	/**
	 * isValid(v)
	 * - 목적: 컨텍스트의 "최소 요건"을 만족하는지 확인
	 * - 조건:
	 *   1) from/to가 존재
	 *   2) 다음 중 하나라도 존재: (양수 builtYear) | (양수 buildingId) | (pnu 문자열) | (좌표)
	 * - 이유: 예측 구간과 대상 식별/위치 정보가 없으면 이후 단계(차트/KPI) 계산이 불가
	 */
	function isValid(v) {
		if (!v) return false;
		const hasFT = nonEmpty(v.from) && nonEmpty(v.to);
		const hasKey =
			(nvPos(v.builtYear) !== undefined) ||		// 양수만 유효
			(nvPos(v.buildingId) !== undefined) ||
			nonEmpty(v.pnu) ||
			isFiniteNum(v.lat) || isFiniteNum(v.lon);
		return !!(hasFT && hasKey);
	}

	/**
	 * normalize(v)
	 * - 목적: 숫자/문자 필드를 안전하게 변환하고, 대체 키(use_name 등)를 수렴합니다.
	 * - 주의: builtYear는 양수만 인정(nvPos), floorArea/area는 숫자로 변환(nv)
	 */
	function normalize(v) {
		const by = nvPos(v.builtYear);
		return {
			buildingId: nvPos(v.buildingId),
			builtYear:  by,
			useName:    v.useName ?? v.use_name ?? undefined,
			floorArea:  nv(v.floorArea) ?? nv(v.area),
			area:       nv(v.area),
			pnu:        sv(v.pnu),
			from:       String(v.from ?? NOW_YEAR),
			to:         String(v.to   ?? (NOW_YEAR + HORIZON_YEARS)),
			lat:        isFiniteNum(v.lat) ? Number(v.lat) : undefined,
			lon:        isFiniteNum(v.lon) ? Number(v.lon) : undefined
		};
	}

	/**
	 * nv(x): 숫자 변환(공백/빈문자/null→undefined, 숫자 아님→undefined)
	 * - 예: nv('  12 ') → 12, nv('') → undefined, nv('abc') → undefined
	 */
	function nv(x) {
		if (x == null) return undefined;
		const s = String(x).trim();
		if (s === '') return undefined;
		const n = Number(s);
		return Number.isFinite(n) ? n : undefined;
	}

	/**
	 * nvPos(x): 양수 숫자만 허용
	 * - 예: nvPos('0') → undefined, nvPos('-1') → undefined, nvPos('13') → 13
	 */
	function nvPos(x) {
		const n = nv(x);
		return (Number.isFinite(n) && n > 0) ? n : undefined; // 양수만
	}

	/**
	 * sv(x): 문자열 정규화(공백/빈문자/null→undefined)
	 */
	function sv(x) {
		if (x == null) return undefined;
		const s = String(x).trim();
		return s ? s : undefined;
	}

	/**
	 * nonEmpty(x): 존재하고 공백이 아닌 문자열 여부
	 */
	function nonEmpty(x) { return x != null && String(x).trim() !== ''; }

	/**
	 * isFiniteNum(x): 유한 숫자 여부(문자 입력도 숫자로 변환 가능하면 true)
	 */
	function isFiniteNum(x) { const n = Number(x); return Number.isFinite(n); }

	/**
	 * hasAny(o): 객체에 의미 있는 값이 하나라도 있는지 검사
	 */
	function hasAny(o) { return !!(o && Object.values(o).some(v => v != null && String(v) !== '')); }

	/* ------------------------ 전역 노출 ------------------------ */
	/**
	 * 전역/모듈 시스템 노출
	 * - global.getBuildingContext: 간편 호출용(레거시/테스트)
	 * - window.SG.providers.getBuildingContext: 앱 내부에서 표준 접근 경로
	 * - CommonJS(module.exports) 호환: 테스트/빌드 환경 지원
	 */
	global.getBuildingContext = getBuildingContext;
	if (typeof window !== 'undefined') {
		window.SG = window.SG || {};
		window.SG.providers = { getBuildingContext };
	}
	if (typeof exports === 'object' && typeof module !== 'undefined') {
		module.exports = { getBuildingContext };
	}
})(window);
