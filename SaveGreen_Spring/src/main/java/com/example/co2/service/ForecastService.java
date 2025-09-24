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

        // --- Stub 데이터(2024~2026만) ---
        var before = List.of(2_450_000L, 2_410_000L, 2_370_000L);
        var after  = List.of(2_450_000L, 2_110_000L, 2_090_000L);
        var saving = List.of(0L, 300_000L, 280_000L);

        var costBefore = List.of(294_000_000L, 289_000_000L, 284_000_000L);
        var costAfter  = List.of(294_000_000L, 253_000_000L, 250_000_000L);
        var costSaving = List.of(0L, 41_000_000L, 34_000_000L);

        var co2Before = List.of(1_049_000L, 1_033_000L, 1_017_000L); // kg/yr
        var co2After  = List.of(1_049_000L,   897_000L,   878_000L);
        var co2Saving = List.of(0L, 152_000L, 139_000L);

        double payback = 4.5;
        Double savingPct = null; // FE에서 필요 시 계산

        String label = decideLabel(averageSavingPct(before, saving), payback);

        return new ForecastResponse(
                buildingId,
                new Meta(fromYear, toYear, "KRW", 3.0, 0.428),
                new Series(before, after, saving),
                new Cost(costBefore, costAfter, costSaving),
                new Co2(co2Before, co2After, co2Saving),
                new Kpi(300_000, 20_000_000, savingPct, payback),
                new Status(label)
        );
    }

    /** 추천/조건부/비추천 BE 판정 규칙(예시) */
    private String decideLabel(double savingPct, double paybackYears) {
        if (savingPct >= 15.0 && paybackYears <= 5.0) return "RECOMMEND";
        if (paybackYears <= 8.0) return "CONDITIONAL";
        return "NOT_RECOMMEND";
    }

    /** 여러 해 평균 절감률(%) */
    private double averageSavingPct(List<Long> before, List<Long> saving) {
        int n = Math.min(before.size(), saving.size());
        if (n == 0) return 0.0;
        double sum = 0.0;
        int cnt = 0;
        for (int i = 0; i < n; i++) {
            long b = before.get(i);
            long s = saving.get(i);
            if (b > 0 && s > 0) {
                sum += (double) s / (double) b * 100.0;
                cnt++;
            }
        }
        return cnt == 0 ? 0.0 : sum / cnt;
    }
}
