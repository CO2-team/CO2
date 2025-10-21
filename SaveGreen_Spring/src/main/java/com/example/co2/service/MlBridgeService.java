package com.example.co2.service;

import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import java.net.URI;
import java.util.List;
import java.util.Map;

@Service
public class MlBridgeService {

	// =========================================================================
	// 필드 / 생성자
	// - FastAPI(ML) 호출용 RestTemplate 과 베이스 URL
	// - 오케스트레이션(시작하기)용 폴링 간격 / 최대 대기시간
	// =========================================================================
	private final RestTemplate mlRestTemplate;	// FastAPI 호출용
	private final String mlBaseUrl;				// 예) http://127.0.0.1:8000

	@Value("${ml.orchestrate.poll-interval-ms:800}")     // 프로퍼티 없으면 기본 800ms
	private long pollIntervalMs;

	@Value("${ml.orchestrate.wait-timeout-ms:180000}")   // 프로퍼티 없으면 기본 180,000ms(3분)
	private long waitTimeoutMs;

	public MlBridgeService(
			@Qualifier("mlRestTemplate") RestTemplate mlRestTemplate,
			@Value("${ml.base-url}") String mlBaseUrl
	) {
		this.mlRestTemplate = mlRestTemplate;
		// baseUrl 끝의 슬래시 제거(URI 조합 시 // 방지)
		this.mlBaseUrl = (mlBaseUrl != null && mlBaseUrl.endsWith("/"))
				? mlBaseUrl.substring(0, mlBaseUrl.length() - 1)
				: mlBaseUrl;
	}

	// =========================================================================
	// 공용 유틸
	// =========================================================================
	private RuntimeException asRuntime(String msg, RestClientException e) {
		if (e instanceof HttpStatusCodeException ex) {
			String detail = ex.getResponseBodyAsString();
			return new RuntimeException(msg + " — status=" + ex.getStatusCode() + ", body=" + detail, e);
		}
		return new RuntimeException(msg + " — " + e.getMessage(), e);
	}

	// =========================================================================
	// 0) Health — GET /health
	// - ML 서버의 헬스 상태를 그대로 반환(Map)
	// =========================================================================
	public Map<String, Object> health() {
		try {
			return mlRestTemplate.getForObject(mlBaseUrl + "/health", Map.class);
		} catch (RestClientException e) {
			throw asRuntime("GET /health failed", e);
		}
	}

	// =========================================================================
	// 1) 학습 시작 — POST /train?mode=...&k=...
	// - 컨트롤러/기존 코드 호환을 위해 startTraining 별칭도 제공
	// - 반환값: jobId (학습 작업 식별자)
	// =========================================================================
	public String startTrain(String mode, Integer k) {
		try {
			URI uri = UriComponentsBuilder.fromHttpUrl(mlBaseUrl + "/train")
					.queryParam("mode", mode != null ? mode : "quick")
					.queryParam("k",    k    != null ? k    : 5)
					.build(true).toUri();

			Map<?, ?> resp = mlRestTemplate.postForObject(uri, null, Map.class);
			if (resp == null || !resp.containsKey("jobId")) {
				throw new IllegalStateException("train response has no jobId");
			}
			return String.valueOf(resp.get("jobId"));
		} catch (RestClientException e) {
			throw asRuntime("POST /train failed", e);
		}
	}

	// ---- 기존 컨트롤러 호환용 별칭: 내부적으로 startTrain 위임
	public String startTraining(String mode, int k) {
		return startTrain(mode, k);
	}

	// =========================================================================
	// 2) 학습 상태 — GET /train/status/{jobId}
	// - 응답 예시: { detail:{ state:"READY"|"FAILED"|..., progress:.., log:[...] }, ... }
	// =========================================================================
	public Map<String, Object> trainStatus(String jobId) {
		try {
			return mlRestTemplate.getForObject(mlBaseUrl + "/train/status/{id}", Map.class, jobId);
		} catch (RestClientException e) {
			throw asRuntime("GET /train/status failed (jobId=" + jobId + ")", e);
		}
	}

	// =========================================================================
	// 3) 모델 재로딩 — POST /admin/reload-model
	// - 학습 완료 후 C(앙상블) 추천 가중치가 즉시 반영되도록 트리거
	// =========================================================================
	public Map<String, Object> reloadModel() {
		try {
			return mlRestTemplate.postForObject(mlBaseUrl + "/admin/reload-model", null, Map.class);
		} catch (RestClientException e) {
			throw asRuntime("POST /admin/reload-model failed", e);
		}
	}

	// =========================================================================
	// 4) 단건 예측 — POST /predict?variant=A|B|C
	// - body: ML 서버의 PredictRequest JSON과 동일한 맵
	// - 응답: { savingKwhYr, savingCostYr, savingPct, paybackYears, label }
	// =========================================================================
	public Map<String, Object> predict(String variant, Map<String, Object> body) {
		try {
			URI uri = UriComponentsBuilder.fromHttpUrl(mlBaseUrl + "/predict")
					.queryParam("variant", variant != null ? variant : "C")
					.build(true).toUri();
			return mlRestTemplate.postForObject(uri, body, Map.class);
		} catch (RestClientException e) {
			throw asRuntime("POST /predict failed (variant=" + variant + ")", e);
		}
	}

	// ---- 편의 메서드: variant 고정
	public Map<String, Object> predictA(Map<String, Object> body) { return predict("A", body); }
	public Map<String, Object> predictB(Map<String, Object> body) { return predict("B", body); }
	public Map<String, Object> predictC(Map<String, Object> body) { return predict("C", body); }

	// =========================================================================
	// 5) (원클릭) 오케스트레이션 — 학습→상태폴링→재로딩
	// - POST /api/forecast/ml/start?mode=quick&k=5 에서 사용
	// - READY면 reloadModel() 호출 후 즉시 성공 응답
	// - FAILED면 실패 응답, 타임아웃 시 TIMEOUT 응답
	// - 시연/단순용 동기 버전(운영에서는 @Async 비동기 확장 가능)
	// =========================================================================
	public Map<String, Object> startAndReload(String mode, int k) {
		final String jobId = startTraining(mode, k);
		final long deadline = System.currentTimeMillis() + waitTimeoutMs;

		while (System.currentTimeMillis() < deadline) {
			Map<String, Object> status = trainStatus(jobId);

			// status 예: { jobId:"...", detail:{ state:"TRAINING"|"READY"|"FAILED", ... }, ... }
			String state = null;
			Object detail = status.get("detail");
			if (detail instanceof Map<?, ?> d) {
				Object s = d.get("state");
				if (s != null) state = String.valueOf(s);
			}

			if ("READY".equalsIgnoreCase(state)) {
				reloadModel(); // C 가중치 최신 반영
				return Map.of(
						"jobId", jobId,
						"state", "READY",
						"message", "Training completed and model reloaded."
				);
			}
			if ("FAILED".equalsIgnoreCase(state)) {
				return Map.of(
						"jobId", jobId,
						"state", "FAILED",
						"detail", status,
						"message", "Training failed. See detail.log."
				);
			}

			try { Thread.sleep(pollIntervalMs); } catch (InterruptedException ignored) {}
		}

		return Map.of(
				"jobId", jobId,
				"state", "TIMEOUT",
				"message", "Training did not finish within timeout."
		);
	}

	// =========================================================================
	// 6) 배치 예측 — POST /predict/batch
	// - FastAPI가 리스트 바디를 직접 받도록 구현된 경우, {"items":[...]}가 아닌
	//   리스트 자체(List<Map>)를 전송해야 한다.
	// =========================================================================
	@SuppressWarnings("unchecked")
	public Map<String, Object> predictBatch(String variant, List<Map<String, Object>> items) {
		try {
			URI uri = UriComponentsBuilder.fromHttpUrl(mlBaseUrl + "/predict/batch")
					.queryParam("variant", variant != null ? variant : "C")
					.build(true).toUri();

			return mlRestTemplate.postForObject(uri, items, Map.class);
		} catch (RestClientException e) {
			throw asRuntime("POST /predict/batch failed (variant=" + variant + ")", e);
		}
	}

	// =========================================================================
	// 7) 모델/가중치 상태 — GET /model/status
	// - 예: { has_A:true, has_B:true, ensemble_weights_effective:{wA:..., wB:...}, ... }
	// =========================================================================
	public Map<String, Object> modelStatus() {
		try {
			return mlRestTemplate.getForObject(mlBaseUrl + "/model/status", Map.class);
		} catch (RestClientException e) {
			throw asRuntime("GET /model/status failed", e);
		}
	}
}
