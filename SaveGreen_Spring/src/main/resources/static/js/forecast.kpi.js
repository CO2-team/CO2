// forecast.kpi.js — KPI 계산·상태 판정 모듈(IIFE, 전역/네임스페이스 동시 노출)
(function () {
	// 네임스페이스 보장
	window.SaveGreen = window.SaveGreen || {};
	window.SaveGreen.Forecast = window.SaveGreen.Forecast || {};

    /* ---------- KPI / 상태 / 출력 ---------- */
    // kpi 계산 (API가 준 kpi가 없을때 FE에서 계산)
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

    // 상태 판정(점수 + 라벨)
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
		if (savingPct < 5 || payback > 12) {
			const status = 'not-recommend';
			return { status, label: status, score };
		}

		const status = (score >= 4) ? 'recommend'
		             : (score >= 2) ? 'conditional'
		             : 'not-recommend';
		return { status, label: status, score };
	}

	// 전역/네임스페이스에 노출(기존 호출부 그대로 동작)
	window.computeKpis = computeKpis;
	window.decideStatusByScore = decideStatusByScore;
	window.SaveGreen.Forecast.computeKpis = computeKpis;
	window.SaveGreen.Forecast.decideStatusByScore = decideStatusByScore;
})();