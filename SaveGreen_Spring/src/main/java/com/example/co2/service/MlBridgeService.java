// [수정] 패키지 선언 확인/정정
package com.example.co2.service;

// [수정] DTO 임포트 경로 일치
import com.example.co2.dto.PredictDtos;

import com.example.co2.util.TypeRegionNormalizer;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.time.Instant;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/* =========================================================
 * MlBridgeService.java
 * ---------------------------------------------------------
 * 역할(Service):
 * 	- FastAPI(파이썬)와의 HTTP 브리지
 * 	- 학습: 시작 트리거/상태 저장(메모리 맵), 필요 최소 코드만
 * 	- 예측: 기존 RestTemplate 프록시를 유지
 *
 * FastAPI 계약(기본값 가정 — 필요시 URL만 설정 변경):
 * 	- POST {base}/train              → 학습 시작
 * 	- GET  {base}/train/status?jobId → 학습 상태(선택 구현)
 * 	- POST {base}/predict?variant=C  → 예측
 *
 * 상태 저장:
 * 	- trainJobs(jobId → TrainStatus) 메모리 보관
 * 	- 서버 재기동 시 초기화(의도된 동작, FE 폴백 로직 존재)
 *
 * 예외:
 * 	- 하위 서버 실패/응답 이상: DownstreamException 으로 래핑
 * ========================================================= */
@Service
public class MlBridgeService {

	/* ------------------------------
	 * 구성 값(환경 설정 주입)
	 * ------------------------------ */
	@Value("${ml.fastapi.base-url:http://localhost:8000}")
	private String fastapiBaseUrl;

	private final RestTemplate restTemplate;

	public MlBridgeService(RestTemplate restTemplate) {
		this.restTemplate = restTemplate;
	}

	/* ------------------------------
	 * 학습 상태 저장(메모리)
	 * ------------------------------ */
	// [추가] jobId → 상태
	private final ConcurrentHashMap<String, TrainStatus> trainJobs = new ConcurrentHashMap<>();

	/* =========================================================
	 * 학습(Training)
	 * ========================================================= */

	// [추가]
	// 목적:
	// 	- 학습 잡 생성 및 비동기 실행 트리거
	// 동작:
	// 	1) UUID 기반 jobId 생성
	// 	2) 상태를 RUNNING(0%)로 맵에 저장
	// 	3) runTrainJob(jobId)을 비동기로 호출
	// 반환:
	// 	- 생성된 jobId
	// 실패 시:
	// 	- 런타임 예외 전파 → 컨트롤러에서 500 처리
	public String startTrainAsync() {
		final String jobId = UUID.randomUUID().toString();
		TrainStatus init = new TrainStatus();
		init.setJobId(jobId);
		init.setStatus("RUNNING");
		init.setProgress(0);
		init.setStartedAt(Instant.now().toString());
		trainJobs.put(jobId, init);

		// 비동기 처리(스레드 풀에서 실행)
		runTrainJob(jobId);
		return jobId;
	}

	// [추가]
	// 목적:
	// 	- FastAPI /train 호출을 비동기로 수행
	// 주의:
	// 	- 여기서는 "간단 모드": /train 호출이 성공하면 DONE 으로 기록
	// 	- 필요시 FastAPI의 /train/status 폴링을 이 메서드에서 추가 구현 가능
	// 입력:
	// 	- jobId: 상태 저장용 키
	// 부작용:
	// 	- trainJobs 맵의 해당 job 상태가 DONE/ERROR 로 갱신됨
	@Async
	public void runTrainJob(String jobId) {
		try {
			String url = fastapiBaseUrl + "/train";
			HttpHeaders headers = new HttpHeaders();
			headers.setAccept(java.util.Collections.singletonList(MediaType.APPLICATION_JSON));

			// 보통 학습 시작에는 별도 바디가 필요 없으나, 필요 시 간단 파라미터를 넘길 수 있음
			HttpEntity<?> req = new HttpEntity<>(headers);

			ResponseEntity<Map> rsp = restTemplate.exchange(url, HttpMethod.POST, req, Map.class);
			if (!rsp.getStatusCode().is2xxSuccessful()) {
				failTrain(jobId, "TRAIN_HTTP_" + rsp.getStatusCodeValue());
				return;
			}

			// 간단 모드: 시작 성공 = DONE. (확장 시 status 폴링으로 대체)
			successTrain(jobId, "TRAIN_STARTED");
		} catch (Exception e) {
			failTrain(jobId, "TRAIN_CALL_FAILED: " + e.getMessage());
		}
	}

	// [추가]
	// 목적:
	// 	- 현재 메모리에 기록된 학습 상태 조회
	// 입력:
	// 	- jobId
	// 반환:
	// 	- TrainStatus 또는 null(미존재)
	public TrainStatus getTrainStatus(String jobId) {
		return trainJobs.get(jobId);
	}

	// [추가] 내부 헬퍼: 학습 성공 기록
	private void successTrain(String jobId, String message) {
		TrainStatus st = trainJobs.get(jobId);
		if (st == null) return;
		st.setStatus("DONE");
		st.setProgress(100);
		st.setMessage(message);
		st.setFinishedAt(Instant.now().toString());
	}

	// [추가] 내부 헬퍼: 학습 실패 기록
	private void failTrain(String jobId, String message) {
		TrainStatus st = trainJobs.get(jobId);
		if (st == null) {
			st = new TrainStatus();
			st.setJobId(jobId);
			trainJobs.put(jobId, st);
		}
		st.setStatus("ERROR");
		st.setMessage(message);
		st.setFinishedAt(Instant.now().toString());
	}

	/* =========================================================
	 * 예측(Predict)
	 * ========================================================= */

	// [추가]
	// 목적:
	// 	- FastAPI /predict 를 호출하여 FE가 요구하는 응답 포맷으로 반환
	// 입력:
	// 	- variant: A|B|C (기본 C) — 하위 서버에 그대로 전달
	// 	- request: PredictRequest (DTO)
	// 동작:
	// 	1) Type/Region 안전 정규화(중복 적용되어도 무해)
	// 	2) POST {base}/predict?variant=... 로 프록시
	// 출력:
	// 	- PredictResponse(JSON) 그대로 반환
	// 예외:
	// 	- HTTP 비정상/바디 null → DownstreamException
	// 	- 기타 예외 → DownstreamException로 래핑
	public PredictDtos.PredictResponse predict(String variant, PredictDtos.PredictRequest request) {
		try {
			TypeRegionNormalizer.normalizeInPlace(request);

			String url = fastapiBaseUrl + "/predict?variant=" + (variant == null ? "C" : variant);
			HttpHeaders headers = new HttpHeaders();
			headers.setContentType(MediaType.APPLICATION_JSON);
			headers.setAccept(java.util.Collections.singletonList(MediaType.APPLICATION_JSON));
			HttpEntity<PredictDtos.PredictRequest> httpEntity = new HttpEntity<>(request, headers);

			ResponseEntity<PredictDtos.PredictResponse> rsp =
					restTemplate.exchange(url, HttpMethod.POST, httpEntity, PredictDtos.PredictResponse.class);

			if (!rsp.getStatusCode().is2xxSuccessful() || rsp.getBody() == null) {
				throw new DownstreamException("PREDICT_HTTP_" + rsp.getStatusCodeValue());
			}
			return rsp.getBody();
		} catch (DownstreamException de) {
			throw de;
		} catch (Exception e) {
			throw new DownstreamException("PREDICT_CALL_FAILED: " + e.getMessage());
		}
	}

	/* =========================================================
	 * 내부 타입/예외
	 * ========================================================= */

	// [추가]
	// 메모리 상태 객체(간단 POJO)
	public static class TrainStatus {
		private String jobId;		// 식별자
		private String status;		// RUNNING | DONE | ERROR
		private Integer progress;	// 0~100(선택)
		private String message;		// 상태/오류 메시지(선택)
		private String startedAt;	// ISO-8601 문자열(선택)
		private String finishedAt;	// ISO-8601 문자열(선택)

		public String getJobId() { return jobId; }
		public void setJobId(String jobId) { this.jobId = jobId; }
		public String getStatus() { return status; }
		public void setStatus(String status) { this.status = status; }
		public Integer getProgress() { return progress; }
		public void setProgress(Integer progress) { this.progress = progress; }
		public String getMessage() { return message; }
		public void setMessage(String message) { this.message = message; }
		public String getStartedAt() { return startedAt; }
		public void setStartedAt(String startedAt) { this.startedAt = startedAt; }
		public String getFinishedAt() { return finishedAt; }
		public void setFinishedAt(String finishedAt) { this.finishedAt = finishedAt; }
	}

	// [추가]
	// 하위 서버 오류 전달용 런타임 예외
	public static class DownstreamException extends RuntimeException {
		public DownstreamException(String message) {
			super(Objects.requireNonNullElse(message, "Downstream error"));
		}
	}
}
