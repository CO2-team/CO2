package com.example.co2.api;

import com.example.co2.dto.ForecastDtos.ForecastResponse;
import com.example.co2.service.ForecastService;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/forecast") // ← 클래스 레벨 고정
public class ForecastApiController {

    private final ForecastService forecastService;
    public ForecastApiController(ForecastService forecastService) {
        this.forecastService = forecastService;
    }

    // id 있는 버전: /api/forecast/1?from=2024&to=2027
    @GetMapping("/{buildingId}")
    public ForecastResponse byBuilding(
            @PathVariable long buildingId,         // primitive로 바꿔 바인딩 실패시 즉시 에러
            @RequestParam int from,
            @RequestParam int to,
            @RequestParam(required = false) String scenario
    ) {
        return forecastService.forecast(buildingId, from, to, scenario);
    }

    // id 없는 버전: /api/forecast?from=2024&to=2027
    @GetMapping
    public ForecastResponse byScenario(
            @RequestParam int from,
            @RequestParam int to,
            @RequestParam(required = false) String scenario
    ) {
        return forecastService.forecast(null, from, to, scenario);
    }

    // 잘못된 범위 등은 400으로
    @ExceptionHandler(IllegalArgumentException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public Map<String, String> handleIllegalArgument(IllegalArgumentException ex) {
        return Map.of("error", ex.getMessage());
    }
}
