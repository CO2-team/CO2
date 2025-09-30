package com.example.co2.api;

import com.example.co2.dto.ForecastDtos.ForecastResponse;
import com.example.co2.service.ForecastService;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping(value = "/api/forecast", produces = MediaType.APPLICATION_JSON_VALUE)
public class ForecastApiController {

    private final ForecastService forecastService;

    public ForecastApiController(ForecastService forecastService) {
        this.forecastService = forecastService;
    }

    /** id 없음: /api/forecast?from=2024&to=2030 */
    @GetMapping
    public ResponseEntity<ForecastResponse> getForecastNoId(
            @RequestParam(required = false, defaultValue = "2024") Integer from,
            @RequestParam(required = false, defaultValue = "2030") Integer to,
            @RequestParam(required = false, defaultValue = "default") String scenario,
            @RequestParam(required = false) Integer builtYear
    ) {
        ForecastResponse res = forecastService.forecast(
                null,
                safe(from, 2024),
                safe(to, 2030),
                scenario,
                builtYear
        );
        return ResponseEntity.ok(res);
    }

    /** id 있음: /api/forecast/{buildingId}?from=2024&to=2030 */
    @GetMapping("/{buildingId}")
    public ResponseEntity<ForecastResponse> getForecastById(
            @PathVariable Long buildingId,
            @RequestParam(required = false, defaultValue = "2024") Integer from,
            @RequestParam(required = false, defaultValue = "2030") Integer to,
            @RequestParam(required = false, defaultValue = "default") String scenario,
            @RequestParam(required = false) Integer builtYear
    ) {
        ForecastResponse res = forecastService.forecast(
                buildingId,
                safe(from, 2024),
                safe(to, 2030),
                scenario,
                builtYear
        );
        return ResponseEntity.ok(res);
    }

    private int safe(Integer v, int fallback) {
        return (v == null) ? fallback : v;
    }
}
