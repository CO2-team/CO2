package com.example.co2.api;

import com.example.co2.dto.ForecastDtos.ForecastResponse;
import com.example.co2.service.ForecastService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * /api/forecast 엔드포인트
 * - /api/forecast            : buildingId 없이(from/to + builtYear>0 또는 pnu 필요)
 * - /api/forecast/{id}       : buildingId 경로변수 사용
 * 공통 규칙
 *  - from/to가 같으면 7년 구간으로 확장(from ~ from+6)
 *  - builtYear <= 0 이면 무시(null로 처리)
 *  - 컨텍스트 없으면 400 (빈 진입 보호)
 */
@RestController
@RequiredArgsConstructor
public class ForecastApiController {

    private final ForecastService forecastService;

    /** id 없음: /api/forecast?from=2024&to=2030&scenario=default&builtYear=2011&use=...&floorArea=...&pnu=... */
    @GetMapping("/api/forecast")
    public ResponseEntity<ForecastResponse> getForecastNoId(
            @RequestParam(required = false, defaultValue = "2024") Integer from,
            @RequestParam(required = false, defaultValue = "2030") Integer to,
            @RequestParam(required = false, defaultValue = "default") String scenario,
            @RequestParam(required = false) Integer builtYear,
            @RequestParam(required = false) String use,
            @RequestParam(required = false) Double floorArea,
            @RequestParam(required = false) String pnu
    ) {
        int yyFrom = safeInt(from, 2024);
        int yyTo   = safeInt(to,   2030);
        int[] norm = normalizeRange(yyFrom, yyTo);
        yyFrom = norm[0];
        yyTo   = norm[1];

        // builtYear 정규화(0/음수는 무시)
        Integer by = (builtYear != null && builtYear > 0) ? builtYear : null;

        // ✅ 컨텍스트 가드: builtYear(양수) 또는 pnu 둘 중 하나라도 있어야 함
        boolean hasKey = (by != null) || nonEmpty(pnu);
        if (!hasKey) {
            return ResponseEntity.badRequest().build();
        }

        ForecastResponse res = forecastService.forecast(
                null,          // buildingId 없음
                yyFrom, yyTo,
                scenario,
                by,
                use,
                floorArea,
                pnu
        );
        return ResponseEntity.ok(res);
    }

    /** id 버전: /api/forecast/{id}?from=2024&to=2030&scenario=default&builtYear=...&use=...&floorArea=...&pnu=... */
    @GetMapping("/api/forecast/{id}")
    public ResponseEntity<ForecastResponse> getForecastById(
            @PathVariable("id") Long buildingId,
            @RequestParam(required = false, defaultValue = "2024") Integer from,
            @RequestParam(required = false, defaultValue = "2030") Integer to,
            @RequestParam(required = false, defaultValue = "default") String scenario,
            @RequestParam(required = false) Integer builtYear,
            @RequestParam(required = false) String use,
            @RequestParam(required = false) Double floorArea,
            @RequestParam(required = false) String pnu
    ) {
        int yyFrom = safeInt(from, 2024);
        int yyTo   = safeInt(to,   2030);
        int[] norm = normalizeRange(yyFrom, yyTo);
        yyFrom = norm[0];
        yyTo   = norm[1];

        Integer by = (builtYear != null && builtYear > 0) ? builtYear : null;

        ForecastResponse res = forecastService.forecast(
                buildingId,
                yyFrom, yyTo,
                scenario,
                by,
                use,
                floorArea,
                pnu
        );
        return ResponseEntity.ok(res);
    }

    /* ---------- helpers ---------- */

    // null이면 기본값, 아니면 intValue 반환
    private static int safeInt(Integer v, int fallback) {
        return (v == null) ? fallback : v.intValue();
    }

    // from/to 보정: to<from → swap, 같으면 7년 확장
    private static int[] normalizeRange(int from, int to) {
        if (to < from) { int t = from; from = to; to = t; }
        if (to == from) to = from + 6;
        return new int[]{ from, to };
    }

    private static boolean nonEmpty(String s) {
        return s != null && !s.trim().isEmpty();
    }
}
