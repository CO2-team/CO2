// src/main/java/com/example/co2/api/ForecastMlController.java
// ============================================================================
// SaveGreen / ForecastMlController
// ----------------------------------------------------------------------------
// [역할]
// - FE(그린 리모델링 페이지)에서 호출하는 ML 브리지 API를 제공한다.
// - 실제 ML 호출은 MlBridgeService가 담당하고, 컨트롤러는 HTTP 계약(엔드포인트/파라미터/상태코드)만 책임진다.
//   1) POST /api/forecast/ml/train           → 학습 시작(jobId 반환)
//   2) GET  /api/forecast/ml/train/status    → 학습 상태 조회(폴링)
//   3) POST /api/forecast/ml/predict         → 예측(variant=A|B|C)
//   4) POST /api/forecast/ml/start           → (원클릭) 학습→폴링→재로딩까지 자동
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
// - (대안) 원클릭
//    → POST /api/forecast/ml/start?mode=quick&k=5
//      ↳ 내부적으로 학습 시작→상태 폴링→모델 재로딩까지 완료 후 상태 반환(READY/FAILED/TIMEOUT)
//
// [설계 포인트]
// - 반환은 모두 ResponseEntity로 감싼다(상태/헤더 확장 용이).
// - 요청 바디는 Map<String,Object>로 받아 서비스에 그대로 위임(직렬화/역직렬화 안정).
// - 서비스 메서드 명/시그니처와 정확히 맞춘다(startTraining / trainStatus / predict / startAndReload).
// - 예외 처리는 전역(@ControllerAdvice)으로 일원화하는 것을 권장(여기서는 단순 위임).
// - 필요 시 @CrossOrigin을 활성화해 FE 도메인을 한정(CORS 보안)할 수 있다.
// ============================================================================

package com.example.co2.api;

import com.example.co2.service.MlBridgeService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping(
		path = "/api/forecast/ml",
		produces = MediaType.APPLICATION_JSON_VALUE
)
@RequiredArgsConstructor
// @CrossOrigin(origins = "http://localhost:3000") // FE 도메인만 허용하고 싶을 때 활성화
public class ForecastMlController {

	private final MlBridgeService ml;

	// --------------------------------------------------------------------
	// 1) 학습 시작 — POST /api/forecast/ml/train
	//    - 쿼리: mode(기본 "quick"), k(기본 5)
	//    - 응답: { "jobId": "..." }
	//    - 주의: 서비스는 startTraining 별칭을 제공(내부적으로 startTrain 호출)
	// --------------------------------------------------------------------
	@PostMapping(value = "/train")
	public ResponseEntity<Map<String, Object>> train(
			@RequestParam(name = "mode", defaultValue = "quick") String mode,
			@RequestParam(name = "k",    defaultValue = "5")     int k
	) {
		String jobId = ml.startTraining(mode, k);
		return ResponseEntity.ok(Map.of("jobId", jobId));
	}

	// --------------------------------------------------------------------
	// 2) 학습 상태 — GET /api/forecast/ml/train/status?jobId=...
	//    - 응답 예: { state:"READY", progress:100, log:[...], ... }
	//    - 주의: 서비스 메서드명은 trainStatus (getTrainStatus 아님)
	// --------------------------------------------------------------------
	@GetMapping(value = "/train/status")
	public ResponseEntity<Map<String, Object>> trainStatus(@RequestParam("jobId") String jobId) {
		Map<String, Object> body = ml.trainStatus(jobId);
		return ResponseEntity.ok(body);
	}

	// --------------------------------------------------------------------
	// 2-1) 학습 상태(경로형) — GET /api/forecast/ml/train/status/{jobId}
	//     - FE가 /.../status/{jobId} 형태로 호출해도 동작하도록 호환용 추가
	// --------------------------------------------------------------------
	@GetMapping("/train/status/{jobId}")
	public ResponseEntity<Map<String, Object>> trainStatusPath(@PathVariable String jobId) {
		return ResponseEntity.ok(ml.trainStatus(jobId));
	}


	// --------------------------------------------------------------------
	// 3) 예측 — POST /api/forecast/ml/predict?variant=A|B|C
	//    - consumes: application/json (PredictRequest JSON과 동일한 구조)
	//    - 바디: Map<String,Object> (DTO를 쓰고 싶다면 컨버팅해서 서비스를 호출)
	//    - 응답: { savingKwhYr, savingCostYr, savingPct, paybackYears, label }
	// --------------------------------------------------------------------
	@PostMapping(value = "/predict", consumes = MediaType.APPLICATION_JSON_VALUE)
	public ResponseEntity<Map<String, Object>> predict(
			@RequestParam(name = "variant", defaultValue = "C") String variant,
			@RequestBody Map<String, Object> body
	) {
		Map<String, Object> resp = ml.predict(variant, body);
		return ResponseEntity.ok(resp);
	}

	// --------------------------------------------------------------------
	// 4) (원클릭) 학습→폴링→재로딩 — POST /api/forecast/ml/start?mode=quick&k=5
	//    - 내부적으로 MlBridgeService.startAndReload()를 호출
	//    - 응답 예:
	//      { "jobId":"...", "state":"READY",  "message":"..." } 또는
	//      { "jobId":"...", "state":"FAILED", "detail":{...} } 또는
	//      { "jobId":"...", "state":"TIMEOUT","message":"..." }
	//    - 참고: 동기 처리(요청 대기). 운영에서 즉시 응답 원하면 비동기 버전(@Async) 엔드포인트 추가 가능.
	// --------------------------------------------------------------------
	@PostMapping(value = "/start")
	public ResponseEntity<Map<String, Object>> start(
			@RequestParam(name = "mode", defaultValue = "quick") String mode,
			@RequestParam(name = "k",    defaultValue = "5")     int k
	) {
		Map<String, Object> result = ml.startAndReload(mode, k);
		return ResponseEntity.ok(result);
	}

	// --------------------------------------------------------------------
	// 5) 모델 상태 — GET /api/forecast/ml/status
	//    - FastAPI의 /model/status 프록시
	//    - 예: { has_A:true, has_B:true, ensemble_weights_effective:{wA:..., wB:...}, ... }
	// --------------------------------------------------------------------
	@GetMapping("/status")
	public ResponseEntity<Map<String, Object>> status() {
		return ResponseEntity.ok(ml.modelStatus());
	}

	// --------------------------------------------------------------------
	// 6) 수동 재로딩 — POST /api/forecast/ml/reload
	//    - 필요 시 화면에서 수동 리로드 버튼을 두고 호출
	// --------------------------------------------------------------------
	@PostMapping("/reload")
	public ResponseEntity<Map<String, Object>> reload() {
		return ResponseEntity.ok(ml.reloadModel());
	}

}
