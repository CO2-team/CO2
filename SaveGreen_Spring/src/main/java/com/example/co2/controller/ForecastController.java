package com.example.co2.controller;

import com.example.co2.dto.ForecastDtos.ForecastResponse;
import com.example.co2.service.ForecastService;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.Year;

@RestController
@RequestMapping("/api")
public class ForecastController {

    private final ForecastService forecastService;

    public ForecastController(ForecastService forecastService) {
        this.forecastService = forecastService;
    }

    /**
     * GET /api/forecast/{id}
     *   - 방식 A) 명시적:  ?from=2026&to=2033
     *   - 방식 B) 가변식:  ?baseYear=2026&horizon=8
     *   - 혼용 시 우선순위: from/to > baseYear/horizon
     *
     * 기본값:
     *   - 아무 것도 없으면: baseYear = 올해, horizon = 7 (적당한 기본치)
     *   - from만 있고 to가 없으면: to = from + (horizonDefault - 1)
     *   - horizon 상한/하한은 컨트롤러에서 1~10 정도로 가드(서비스에서 최종 보정 가능)
     *
     * 참고:
     *   - 하드 클램핑(2024~2030 같은)은 제거. 모델 능력 범위는 서비스 계층에서 판단/보정.
     */
    @GetMapping(value = "/forecast/{id}", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<ForecastResponse> forecast(
            @PathVariable("id") Long buildingId,
            @RequestParam(required = false) Integer from,
            @RequestParam(required = false) Integer to,
            @RequestParam(required = false) Integer baseYear,
            @RequestParam(required = false) Integer horizon,
            @RequestParam(defaultValue = "retrofit") String scenario
    ) {
        final int current = Year.now().getValue();
        final int DEFAULT_HORIZON = 7;     // 운영 기본치(임시). 5~10 사이에서 PM이 조정 가능.
        final int MIN_HORIZON = 1;
        final int MAX_HORIZON = 10;

        Integer effFrom = null;
        Integer effTo   = null;

        if (from != null || to != null) {
            // A) 명시적 구간 우선
            if (from == null && to != null) {
                // to만 왔을 때는 baseYear로 간주해서 역산 (to - DEFAULT_HORIZON + 1)
                effTo = to;
                effFrom = to - (DEFAULT_HORIZON - 1);
            } else if (from != null && to == null) {
                effFrom = from;
                effTo   = from + (DEFAULT_HORIZON - 1);
            } else {
                effFrom = from;
                effTo   = to;
            }
        } else {
            // B) 가변식 구간
            int by = (baseYear != null) ? baseYear : current;
            int hz = (horizon  != null) ? horizon  : DEFAULT_HORIZON;

            // 가드(너무 과한 요청 방지 – 실제 모델/데이터 한계는 서비스에서 최종 판단)
            if (hz < MIN_HORIZON) hz = MIN_HORIZON;
            if (hz > MAX_HORIZON) hz = MAX_HORIZON;

            effFrom = by;
            effTo   = by + hz - 1;
        }

        // from > to 인 경우 스왑(사용자 입력 실수 방지)
        if (effFrom > effTo) {
            int tmp = effFrom; effFrom = effTo; effTo = tmp;
        }

        // 최종적으로 서비스에 위임
        ForecastResponse res = forecastService.forecast(buildingId, effFrom, effTo, scenario);
        return ResponseEntity.ok(res);
    }
}
