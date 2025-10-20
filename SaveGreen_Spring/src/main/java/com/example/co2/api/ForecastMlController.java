// src/main/java/com/example/co2/api/ForecastMlController.java
// ============================================================================
// SaveGreen / ForecastMlController
// ----------------------------------------------------------------------------
// [역할]
// - FE(그린 리모델링 페이지)에서 호출하는 ML 브리지 API를 제공한다.
// - 실제 ML 호출은 MlBridgeService가 담당하고, 컨트롤러는 HTTP 계약만 책임진다.
//   1) POST /api/forecast/ml/train           → 학습 시작(jobId 반환)
//   2) GET  /api/forecast/ml/train/status    → 학습 상태 조회(폴링)
//   3) POST /api/forecast/ml/predict         → 예측(variant=A|B|C)
//
// [FE 플로우 예시]
// - '시작하기' 클릭
//    → POST /api/forecast/ml/train?mode=quick&k=5
//      ↳ { "jobId": "..." } 응답
// - 폴링(0.8~1s 간격)
//    → GET  /api/forecast/ml/train/status?jobId=...   (READY 100%가 되면)
// - 차트 요청
//    → POST /api/forecast/ml/predict?variant=A
//    → POST /api/forecast/ml/predict?variant=B
//    → POST /api/forecast/ml/predict?variant=C
//
// [설계 포인트]
// - 반환은 모두 ResponseEntity로 감쌈(상태/헤더 확장 용이).
// - 요청 바디는 Map<String,Object>로 받아 서비스에 그대로 위임(직렬화/역직렬화 안정).
// - 서비스 메서드 명/시그니처와 정확히 맞춤(startTraining/ trainStatus/ predict).
// - 예외 처리는 전역(ExceptionHandler) 또는 컨트롤러 어드바이스로 확장 권장.
// ============================================================================

package com.example.co2.api;

import com.example.co2.service.MlBridgeService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/forecast/ml")
@RequiredArgsConstructor
public class ForecastMlController {

	private final MlBridgeService ml;

	// --------------------------------------------------------------------
	// 1) 학습 시작 — POST /api/forecast/ml/train
	//    - 쿼리: mode(기본 quick), k(기본 5)
	//    - 응답: { "jobId": "..." }
	// --------------------------------------------------------------------
	@PostMapping("/train")
	public ResponseEntity<?> train(
			@RequestParam(name = "mode", defaultValue = "quick") String mode,
			@RequestParam(name = "k",    defaultValue = "5")     int k
	) {
		// MlBridgeService는 startTraining 별칭을 제공(내부적으로 startTrain 호출)
		String jobId = ml.startTraining(mode, k);
		return ResponseEntity.ok(Map.of("jobId", jobId));
	}

	// --------------------------------------------------------------------
	// 2) 학습 상태 — GET /api/forecast/ml/train/status?jobId=...
	//    - 응답 예: { state:"READY", progress:100, log:[...], ... }
	// --------------------------------------------------------------------
	@GetMapping("/train/status")
	public ResponseEntity<?> trainStatus(@RequestParam("jobId") String jobId) {
		// 서비스 메서드명은 trainStatus (getTrainStatus 아님)
		Map<String, Object> body = ml.trainStatus(jobId);
		return ResponseEntity.ok(body);
	}

	// --------------------------------------------------------------------
	// 3) 예측 — POST /api/forecast/ml/predict?variant=A|B|C
	//    - 바디: ML 서버의 PredictRequest JSON과 동일한 구조(Map으로 수신)
	//    - 응답: { savingKwhYr, savingCostYr, savingPct, paybackYears, label }
	// --------------------------------------------------------------------
	@PostMapping("/predict")
	public ResponseEntity<?> predict(
			@RequestParam(name = "variant", defaultValue = "C") String variant,
			@RequestBody Map<String, Object> body
	) {
		Map<String, Object> resp = ml.predict(variant, body);
		return ResponseEntity.ok(resp);
	}
}
