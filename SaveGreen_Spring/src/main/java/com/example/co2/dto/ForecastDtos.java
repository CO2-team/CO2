package com.example.co2.dto;

import java.util.List;
import java.util.Map;

public class ForecastDtos {

    // 응답 최상위
    public record ForecastDto(
            long buildingId,
            Meta meta,
            Series series,
            Cost cost,
            Co2 co2,
            Kpi kpi,
            Status status
    ) {}

    // 메타 데이터
    public record Meta(
            int fromYear,
            int toYear,
            String currency,
            double tariffEscalationPct,
            double co2FactorKgPerKwh,
            List<String> notes
    ) {}

    // 연도별 에너지
    public record Series(
            List<Long> before,
            List<Long> after,
            List<Long> saving
    ) {}

    // 비용
    public record Cost(
            List<Long> before,
            List<Long> after,
            List<Long> saving
    ) {}

    // Co2
    public record Co2(
            List<Long> before,
            List<Long> after,
            List<Long> saving
    ) {}

    // KPI 카드
    public record Kpi(
            long savingKwhYr,
            long savingCostY,
            double savingCo2TonsYr,
            long capex,
            double paybackYears,
            double roiPct
    ) {}

    // 추천 상태
    public record Status(
            String label, // 추천, 조건부, 비추천
            String color, // 녹색, 주황색, 빨간색
            String message
    ) {}
}
