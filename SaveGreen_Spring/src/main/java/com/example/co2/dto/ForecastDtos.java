package com.example.co2.dto;

import java.util.List;

public class ForecastDtos {

    public record ForecastResponse(
            Long buildingId,
            Meta meta,
            Series series,
            Cost cost,
            Co2 co2,
            Kpi kpi,
            Status status
    ) {}

    public record Meta(
            int fromYear,
            int toYear,
            String currency,
            double tariffEscalationPct,
            double co2FactorKgPerKwh
    ) {}

    public record Series(
            List<Long> before,
            List<Long> after,
            List<Long> saving
    ) {}

    public record Cost(
            List<Long> before,
            List<Long> after,
            List<Long> saving
    ) {}

    public record Co2(
            List<Long> before,
            List<Long> after,
            List<Long> saving
    ) {}

    public record Kpi(
            long savingKwhYr,
            long savingCostYr,
            Double savingPct,     // 없으면 FE에서 계산
            double paybackYears
    ) {}

    public record Status(
            String label   // RECOMMEND | CONDITIONAL | NOT_RECOMMEND
    ) {}
}
