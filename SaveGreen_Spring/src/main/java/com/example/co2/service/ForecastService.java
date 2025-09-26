package com.example.co2.service;

import com.example.co2.dto.ForecastDtos.Co2;
import com.example.co2.dto.ForecastDtos.Cost;
import com.example.co2.dto.ForecastDtos.ForecastResponse;
import com.example.co2.dto.ForecastDtos.Kpi;
import com.example.co2.dto.ForecastDtos.Meta;
import com.example.co2.dto.ForecastDtos.Series;
import com.example.co2.dto.ForecastDtos.Status;
import com.example.co2.entity.ApiCache;
import com.example.co2.repository.ApiCacheRepository;
import com.example.co2.util.HashUtils;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Service
public class ForecastService {

    // 설정값
    @Value("${app.cache.ttl-minutes:10}")
    private int ttlMinutes;

    // 기본 범위 / 가정값
    private static final int BASE_YEAR = 2024;
    private static final int LAST_YEAR = 2030;
    // 데모용 투자비용 : paybackYears 계산에 사용
    private static final long DEFAULT_RETROFIT_COST_WON = 90_000_000L;

    private final ApiCacheRepository apiCacheRepository;
    private final ObjectMapper objectMapper;

    public ForecastService(ApiCacheRepository apiCacheRepository, ObjectMapper objectMapper) {
        this.apiCacheRepository = apiCacheRepository;
        this.objectMapper = objectMapper;
    }

    // public API
    public ForecastResponse forecast(Long buildingId, int fromYear, int toYear, String scenario) {
        // 1. 캐시 키
        String keyRaw = buildCacheKeyRaw(buildingId, fromYear, toYear, scenario);
        String keyHash = HashUtils.sha256Hex(keyRaw);

        // 2. 캐시 조회(미만료)
        Optional<ApiCache> cached = apiCacheRepository.findTopByCacheKeyHashAndExpiresAtAfter(keyHash, LocalDateTime.now());
        if (cached.isPresent()) {
            try {
                return objectMapper.readValue(cached.get().getPayloadJson(), ForecastResponse.class);
            } catch (Exception ignore) {
                // 파싱 실패시 무시하고 재 계산
            }
        }

        // 3. 캐시 미스 -> 스텁 계산
        ForecastResponse resp = computeStub(buildingId, fromYear, toYear);

        // 4. 캐시 저장
        try {
            ApiCache entry = new ApiCache();
            entry.setCacheKeyHash(keyHash);
            entry.setCacheKeyRaw(keyRaw);
            entry.setPayloadJson(objectMapper.writeValueAsString(resp));
            entry.setExpiresAt(LocalDateTime.now().plusMinutes(ttlMinutes));
            entry.setBuildingId(buildingId);
            apiCacheRepository.save(entry);
        } catch (Exception igonre) {}

        // 5. 응답
        return resp;
    }

    // 내부 구현
    private String buildCacheKeyRaw(Long buildingId, int fromYear, int toYear, String scenario) {
        String b = (buildingId == null) ? "none" : String.valueOf(buildingId);
        String scen = (scenario == null || scenario.isBlank()) ? "default" : scenario;
        // 추후 area / grade / price 등 시나리오 파라미터 추가되면 여기에 이어 붙이기
        return "buildingId = " + b + ";from=" + fromYear + ";to=" + toYear + ";scenario=" + scen;
    }

    // 1단계에서 만든 "슬라이싱 + KPI 실제 계산" 스텁
    private ForecastResponse computeStub(Long buildingId, int fromYear, int toYear) {
        List<Long> before = null;

        // 에너지(kWh/년)
        var afterFull = List.of(2_150_000L, 1_980_000L, 1_840_000L, 1_720_000L, 1_620_000L, 1_540_000L, 1_480_000L);
        var savingFull = List.of(350_000L, 420_000L, 460_000L, 500_000L, 530_000L, 570_000L, 620_000L);

        // 비용(원/년)
        List<Long> costBefore = null;
        var costAfterFull = List.of(253_000_000L, 250_000_000L, 247_000_000L, 244_000_000L, 241_000_000L, 238_000_000L, 235_000_000L);
        var costSavingFull = List.of(41_000_000L, 34_000_000L, 32_000_000L, 30_000_000L, 28_000_000L, 26_000_000L, 24_000_000L);

        // CO2(kg/년)
        List<Long> co2Before = null;
        var co2AfterFull = List.of(897_000L, 878_000L, 860_000L, 842_000L, 824_000L, 806_000L, 790_000L);
        var co2SavingFull = List.of(152_000L, 139_000L, 130_000L, 120_000L, 112_000L, 100_000L, 95_000L);

        // 요청 범위로 슬라이스
        var after = sliceInclusive(afterFull, fromYear, toYear);
        var saving = sliceInclusive(savingFull, fromYear, toYear);
        var costAfter = sliceInclusive(costAfterFull, fromYear, toYear);
        var costSaving = sliceInclusive(costSavingFull, fromYear, toYear);
        var co2After = sliceInclusive(co2AfterFull, fromYear, toYear);
        var co2Saving = sliceInclusive(co2SavingFull, fromYear, toYear);

        // KPI 대표값 "마지막 연도" 기준
        int last = after.size() - 1;
        long repSavingKwh = saving.get(last);
        long repSavingCost = costSaving.get(last);

        // 절감률(%) = saving / (after + saving) * 100
        double repSavingPct = (double) repSavingKwh / (after.get(last) + repSavingKwh) * 100.0;
        double savingPctRounded = Math.round(repSavingPct * 10.0) / 10.0; // 소주 1자리

        // 회수기간(년) = 투자비 / 연간 절감비용
        double paybackYears = DEFAULT_RETROFIT_COST_WON / (double) repSavingCost;
        double paybackRounded = Math.round(paybackYears * 100.0) / 100.0; // 소수 2자리

        String label = decideLabel(savingPctRounded, paybackRounded);

        return new ForecastResponse(
                buildingId,
                // Meta(시작 / 끝 / 통화 / ...) : 기존 시그니처 유지
                new Meta(Math.max(fromYear, BASE_YEAR), Math.min(toYear, LAST_YEAR), "KRW", 3.0, 0.428),
                new Series(before, after, saving),
                new Cost(costBefore, costAfter, costSaving),
                new Co2(co2Before, co2After, co2Saving),
                new Kpi(
                        repSavingKwh, // savingKwhYr(대표치)
                        repSavingCost, // savingCostYt(대표치)
                        savingPctRounded, // 절감률(%)
                        paybackRounded // 회수기간(년)
                ),
                new Status(label)
        );
    }

    // 연도 슬라이싱 유틸(양끝 포함)
    private static <T> List<T> sliceInclusive(List<T> full, int fromYear, int toYear) {
        int start = Math.max(fromYear, BASE_YEAR) - BASE_YEAR;
        int end = Math.min(toYear, LAST_YEAR) - BASE_YEAR;
        if (start < 0 || end >= full.size() || start > end) {
            throw new IllegalArgumentException("지원하지 않는 연도 범위 : " + fromYear + " ~ " + toYear);
        }
        return full.subList(start, end + 1);
    }

    // 판정 규칙(rule-v1)
    private String decideLabel(double savingPct, double paybackYears) {
        if (savingPct >= 15.0 && paybackYears <= 5.0) return "RECOMMEND";
        if (paybackYears <= 8.0) return "CONDITIONAL";
        return "NOT_RECOMMEND";
    }
}
