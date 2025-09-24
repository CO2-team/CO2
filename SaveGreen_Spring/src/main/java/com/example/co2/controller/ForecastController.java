package com.example.co2.controller;

import com.example.co2.dto.ForecastDtos.ForecastResponse;
import com.example.co2.service.ForecastService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/buildings")
public class ForecastController {

    private final ForecastService forecastService;

    public ForecastController(ForecastService forecastService) {
        this.forecastService = forecastService;
    }

    @GetMapping("/{buildingId}/forecast")
    public ResponseEntity<ForecastResponse> forecast(
            @PathVariable Long buildingId,
            @RequestParam(defaultValue = "2024") int from,
            @RequestParam(defaultValue = "2026") int to,
            @RequestParam(defaultValue = "retrofit") String scenario
    ) {
        return ResponseEntity.ok(forecastService.forecast(buildingId, from, to, scenario));
    }
}
