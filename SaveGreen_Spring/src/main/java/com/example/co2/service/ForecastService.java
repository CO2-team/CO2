package com.example.co2.service;

import com.example.co2.dto.ForecastDtos.Cost;
import com.example.co2.dto.ForecastDtos.ForecastResponse;
import com.example.co2.dto.ForecastDtos.Kpi;
import com.example.co2.dto.ForecastDtos.Series;
import com.example.co2.entity.ApiCache;
import com.example.co2.repository.ApiCacheRepository;
import com.example.co2.util.HashUtils;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

@Service
public class ForecastService {

    @Value("${app.cache.ttl-minutes:10}")
    private int ttlMinutes;

    // FE와 동일 파라미터(더미 생성 기준)
    private static final long   BASE_KWH      = 2_150_000L; // 첫 해 after
    private static final double AFTER_RATE    = 0.06;       // 매년 6% 감소
    private static final long   START_SAVING  = 360_000L;   // 첫 해 saving(kWh)
    private static final double SAVING_RATE   = 0.08;       // 매년 8% 감소
    private static final long   UNIT_PRICE    = 150L;       // 원/kWh (cost.saving 산출)
    private static final long   DEFAULT_RETROFIT_COST_WON = 90_000_000L; // payback 계산용

    private final ApiCacheRepository apiCacheRepository;
    private final ObjectMapper objectMapper;

    public ForecastService(ApiCacheRepository apiCacheRepository, ObjectMapper objectMapper) {
        this.apiCacheRepository = apiCacheRepository;
        this.objectMapper = objectMapper;
    }

    /** 컨트롤러에서 호출되는 공개 메서드 */
    public ForecastResponse forecast(Long buildingId, int fromYear, int toYear, String scenario) {
        // 1) from==to → 7년 확장, from>to → 스왑
        int[] range = normalizeRange(fromYear, toYear);
        int from = range[0], to = range[1];

        // 2) 캐시 키 구성
        String keyRaw = buildCacheKeyRaw(buildingId, from, to, scenario);
        String keyHash = HashUtils.sha256Hex(keyRaw);

        // 3) 캐시 조회(미만료)
        Optional<ApiCache> cached = apiCacheRepository.findTopByCacheKeyHashAndExpiresAtAfter(
                keyHash, LocalDateTime.now()
        );
        if (cached.isPresent()) {
            try {
                return objectMapper.readValue(cached.get().getPayloadJson(), ForecastResponse.class);
            } catch (Exception ignore) {
                // 파싱 실패 시 캐시 미스 처리
            }
        }

        // 4) 계산(현재는 더미 데이터)
        ForecastResponse resp = computeStub(buildingId, from, to);

        // 5) 캐시 저장
        try {
            ApiCache entry = new ApiCache();
            entry.setCacheKeyHash(keyHash);
            entry.setCacheKeyRaw(keyRaw);
            entry.setPayloadJson(objectMapper.writeValueAsString(resp));
            entry.setExpiresAt(LocalDateTime.now().plusMinutes(ttlMinutes));
            entry.setBuildingId(buildingId);
            apiCacheRepository.save(entry);
        } catch (Exception ignore) {}

        return resp;
    }

    /* ===== 내부 구현 ===== */

    private String buildCacheKeyRaw(Long buildingId, int from, int to, String scenario) {
        String b = (buildingId == null) ? "none" : String.valueOf(buildingId);
        String scen = (scenario == null || scenario.isBlank()) ? "default" : scenario;
        return "buildingId=" + b + ";from=" + from + ";to=" + to + ";scenario=" + scen;
    }

    /** from==to면 +6 확장(총 7년), from>to면 스왑 */
    private int[] normalizeRange(int from, int to) {
        if (to < from) { int t = from; from = to; to = t; }
        if (to == from) to = from + 6; // 총 7개 연도
        return new int[]{from, to};
    }

    /** 더미 생성 + KPI 계산 (FE 파라미터와 동일) */
    private ForecastResponse computeStub(Long buildingId, int from, int to) {
        int len = (to - from) + 1;

        // years
        List<String> years = new ArrayList<>(len);
        for (int y = from; y <= to; y++) years.add(String.valueOf(y));

        // series.after / series.saving
        List<Long> after = new ArrayList<>(len);
        List<Long> saving = new ArrayList<>(len);
        for (int i = 0; i < len; i++) {
            long afterVal  = Math.max(0, Math.round(BASE_KWH * Math.pow(1 - AFTER_RATE, i)));
            long savingVal = Math.max(0, Math.round(START_SAVING * Math.pow(1 - SAVING_RATE, i)));
            after.add(afterVal);
            saving.add(savingVal);
        }

        // cost.saving (원/년)
        List<Long> costSaving = new ArrayList<>(len);
        for (int i = 0; i < len; i++) {
            costSaving.add(saving.get(i) * UNIT_PRICE);
        }

        // KPI: 마지막 연도 기준
        int last = len - 1;
        long repSavingKwh  = saving.get(last);
        long repSavingCost = costSaving.get(last);

        double pct = 0.0;
        long lastAfter = after.get(last);
        if (repSavingKwh + lastAfter > 0) {
            pct = (repSavingKwh * 100.0) / (repSavingKwh + lastAfter);
        }
        int savingPctInt = (int) Math.round(pct); // 정수 % (FE와 호환)

        double paybackYears = repSavingCost > 0
                ? (double) DEFAULT_RETROFIT_COST_WON / (double) repSavingCost
                : 0.0;
        paybackYears = Math.round(paybackYears * 100.0) / 100.0; // 소수 2자리

        Series series = new Series(after, saving); // Series(after, saving)
        Cost cost = new Cost(costSaving);          // Cost(saving)
        Kpi kpi = new Kpi(repSavingKwh, repSavingCost, savingPctInt, paybackYears);

        return new ForecastResponse(years, series, cost, kpi);
    }
}
