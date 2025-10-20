package com.example.co2.service;

/*
	============================================================
	MlBridgeService — Spring ↔ FastAPI(ML) 브리지 서비스
	------------------------------------------------------------
	역할
	- FastAPI(ML) 서버와의 모든 HTTP 통신을 캡슐화한다.
	- FE/Controller는 이 서비스만 호출하면 ML 학습/상태/예측을 사용할 수 있다.

	주요 시나리오 (시작하기 플로우)
	1) 학습 시작:            POST /train?mode=quick&k=5                → jobId 수신
	2) 학습 상태 폴링:       GET  /train/status/{jobId}                 → READY/FAILED 등
	3) 모델 재로딩:          POST /admin/reload-model                   → 최신 가중치(C) 반영
	4) 예측 호출:            POST /predict?variant=A|B|C                → 차트/지표 계산
	5) 상태 조회(선택):       GET  /model/status                         → A/B 로드여부·C 가중치 확인
	6) 배치 예측(선택):       POST /predict/batch                        → 여러 건 일괄 계산

	설정
	- baseUrl:   application.properties 의 ml.base-url
	- 타임아웃:  HttpConfig.mlRestTemplate() 에서 ml.timeout-ms.connect/read 적용

	설계 포인트
	- RestTemplate 빈 이름을 "mlRestTemplate"로 고정해서 주입(@Qualifier)한다.
	- baseUrl 뒤의 슬래시를 제거해 URI 조합시에 // 가 생기지 않도록 한다.
	- 예외는 RuntimeException으로 래핑하여 컨트롤러 전역 예외 처리와 연결하기 쉽도록 한다.
	  (운영에서는 커스텀 예외 + 에러코드 매핑으로 확장 가능)

	주의
	- predictBatch 의 요청 바디는 **리스트 자체**를 전송한다.
	  (FastAPI의 @Body(...)가 List 스키마를 직접 받도록 구현되어 있을 때)
	============================================================
*/

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

	private final RestTemplate mlRestTemplate;
	private final String mlBaseUrl; // ex) http://127.0.0.1:8000

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

	// ------------------------------------------------------------------
	// 0) Health — GET /health
	// ------------------------------------------------------------------
	public Map<String, Object> health() {
		try {
			return mlRestTemplate.getForObject(mlBaseUrl + "/health", Map.class);
		} catch (RestClientException e) {
			throw asRuntime("GET /health failed", e);
		}
	}

	// ------------------------------------------------------------------
	// 1) 학습 시작 — POST /train?mode=...&k=...
	//    컨트롤러 호환을 위해 2개의 이름을 제공:
	//    - startTrain(mode, k)    : 신규 명칭
	//    - startTraining(mode, k) : 기존 컨트롤러 호출 호환용 별칭
	//    반환값: jobId (학습 작업 식별자)
	// ------------------------------------------------------------------
	public String startTrain(String mode, Integer k) {
		try {
			URI uri = UriComponentsBuilder.fromHttpUrl(mlBaseUrl + "/train")
					.queryParam("mode", mode != null ? mode : "quick")
					.queryParam("k",    k != null ? k : 5)
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

	/** 기존 컨트롤러 호환용 별칭 (startTraining → startTrain 위임) */
	public String startTraining(String mode, int k) {
		return startTrain(mode, k);
	}

	// ------------------------------------------------------------------
	// 2) 학습 상태 — GET /train/status/{jobId}
	// ------------------------------------------------------------------
	public Map<String, Object> trainStatus(String jobId) {
		try {
			return mlRestTemplate.getForObject(mlBaseUrl + "/train/status/{id}", Map.class, jobId);
		} catch (RestClientException e) {
			throw asRuntime("GET /train/status failed (jobId=" + jobId + ")", e);
		}
	}

	// ------------------------------------------------------------------
	// 3) 모델 재로딩 — POST /admin/reload-model
	//    (학습 완료 후 C(앙상블)의 추천 가중치가 즉시 반영되도록)
	// ------------------------------------------------------------------
	public Map<String, Object> reloadModel() {
		try {
			return mlRestTemplate.postForObject(mlBaseUrl + "/admin/reload-model", null, Map.class);
		} catch (RestClientException e) {
			throw asRuntime("POST /admin/reload-model failed", e);
		}
	}

	// ------------------------------------------------------------------
	// 4) 단건 예측 — POST /predict?variant=A|B|C
	//    body: ML 서버의 PredictRequest JSON과 동일한 맵
	// ------------------------------------------------------------------
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

	public Map<String, Object> predictA(Map<String, Object> body) { return predict("A", body); }
	public Map<String, Object> predictB(Map<String, Object> body) { return predict("B", body); }
	public Map<String, Object> predictC(Map<String, Object> body) { return predict("C", body); }

	// ------------------------------------------------------------------
	// 5) 배치 예측 — POST /predict/batch
	//    주의: FastAPI 엔드포인트가 **리스트 바디**를 직접 받도록 설계되어 있다면
	//          바디를 {"items":[...]}가 아니라 **그냥 List**로 보내야 한다.
	// ------------------------------------------------------------------
	@SuppressWarnings("unchecked")
	public Map<String, Object> predictBatch(String variant, List<Map<String, Object>> items) {
		try {
			URI uri = UriComponentsBuilder.fromHttpUrl(mlBaseUrl + "/predict/batch")
					.queryParam("variant", variant != null ? variant : "C")
					.build(true).toUri();

			// 리스트 자체를 전송 (HttpMessageConverter가 JSON 배열로 직렬화)
			return mlRestTemplate.postForObject(uri, items, Map.class);
		} catch (RestClientException e) {
			throw asRuntime("POST /predict/batch failed (variant=" + variant + ")", e);
		}
	}

	// ------------------------------------------------------------------
	// 6) 모델/가중치 상태 — GET /model/status
	// ------------------------------------------------------------------
	public Map<String, Object> modelStatus() {
		try {
			return mlRestTemplate.getForObject(mlBaseUrl + "/model/status", Map.class);
		} catch (RestClientException e) {
			throw asRuntime("GET /model/status failed", e);
		}
	}

	// ------------------------------------------------------------------
	// 예외 래핑 유틸 — 상태코드/응답바디를 메시지에 포함
	// ------------------------------------------------------------------
	private RuntimeException asRuntime(String msg, RestClientException e) {
		if (e instanceof HttpStatusCodeException ex) {
			String detail = ex.getResponseBodyAsString();
			return new RuntimeException(msg + " — status=" + ex.getStatusCode() + ", body=" + detail, e);
		}
		return new RuntimeException(msg + " — " + e.getMessage(), e);
	}
}
