package com.example.co2.service;

import com.example.co2.dto.ForecastDtos.Co2;
import com.example.co2.dto.ForecastDtos.Cost;
import com.example.co2.dto.ForecastDtos.ForecastResponse;
import com.example.co2.dto.ForecastDtos.Kpi;
import com.example.co2.dto.ForecastDtos.Meta;
import com.example.co2.dto.ForecastDtos.Series;
import com.example.co2.dto.ForecastDtos.Status;
import java.util.List;
import org.springframework.stereotype.Service;

@Service
public class ForecastService {

    public ForecastResponse forecast(Long buildingId, int fromYear, int toYear, String scenario) {

        // ---- Stub: 2024 ~ 2030 (7년) ----
        // before는 빼서 null로 전달
        List<Long> before = null;

        // 에너지(kWh/년) — 2024부터 절감 반영
        // 에너지(kWh/년) — 감소폭 “확” 느껴지도록 조정
        var after  = List.of(2_150_000L, 1_980_000L, 1_840_000L, 1_720_000L, 1_620_000L, 1_540_000L, 1_480_000L);
        var saving = List.of(350_000L,   420_000L,   460_000L,   500_000L,   530_000L,   570_000L,   620_000L);

        // 비용(원/년) — 2024부터 비용 절감 반영
        List<Long> costBefore = null; // ✅ 누락되었던 선언 추가
        var costAfter  = List.of(253_000_000L, 250_000_000L, 247_000_000L, 244_000_000L, 241_000_000L, 238_000_000L, 235_000_000L);
        var costSaving = List.of(41_000_000L,  34_000_000L,  32_000_000L,  30_000_000L,  28_000_000L,  26_000_000L,  24_000_000L);

        // CO2(kg/년) — 2024부터 감축 반영
        List<Long> co2Before = null;  // ✅ 누락되었던 선언 추가
        var co2After  = List.of(897_000L, 878_000L, 860_000L, 842_000L, 824_000L, 806_000L, 790_000L);
        var co2Saving = List.of(152_000L, 139_000L, 130_000L, 120_000L, 112_000L, 100_000L, 95_000L);

        // KPI & 판정
        double paybackYears = 4.5;
        double savingPct = 15.8; // before 없이도 판정/표시에 쓰도록 BE에서 직접 제공
        String label = decideLabel(savingPct, paybackYears);

        return new ForecastResponse(
                buildingId,
                new Meta(2024, 2030, "KRW", 3.0, 0.428),
                new Series(before, after, saving),
                new Cost(costBefore, costAfter, costSaving),
                new Co2(co2Before, co2After, co2Saving),
                new Kpi(
                        300_000L,         // savingKwhYr(대표치)
                        41_000_000L,      // savingCostYr(대표치)
                        savingPct,        // 절감률(%)
                        paybackYears
                ),
                new Status(label)
        );
    }

    /** 추천/조건부/비추천 BE 판정 규칙(예시) */
    private String decideLabel(double savingPct, double paybackYears) {
        if (savingPct >= 15.0 && paybackYears <= 5.0) return "RECOMMEND";
        if (paybackYears <= 8.0) return "CONDITIONAL";
        return "NOT_RECOMMEND";
    }
}
