// package com.example.forecast.api;

// [수정] 패키지 선언 확인/정정
package com.example.co2.api;

// [수정] DTO/서비스/유틸 패키지 임포트 정렬
import com.example.co2.dto.PredictDtos;
import com.example.co2.service.MlBridgeService;
import com.example.co2.util.TypeRegionNormalizer;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/* =========================================================
 * ForecastMlController.java
 * ---------------------------------------------------------
 * 역할(Controller):
 * 	- FE가 요구하는 "학습 → 상태 폴링 → 예측" 3단계를 단일 컨트롤러에서 제공
 * 	- 기존 predict 엔드포인트는 그대로 유지, 학습(train)과 상태(status)만 추가
 *
 * 라우팅(모두 /api/forecast/ml 하위):
 * 	- POST   /train
 * 		· 목적: FastAPI 학습 시작 트리거
 * 		· 출력: { jobId }  (서버가 생성하는 학습 식별자)
 * 	- GET    /train/status?jobId=...
 * 		· 목적: 학습 진행 상태 조회
 * 		· 출력: { jobId, status, progress?, message? }
 * 	- POST   /predict?variant=C
 * 		· 목적: 예측 요청을 FastAPI로 프록시
 * 		· 입력: PredictRequest(JSON body), variant(A|B|C) 쿼리
 * 		· 출력: PredictResponse(JSON) — KPI/series/cost
 *
 * 사전조건:
 * 	- @EnableAsync 필요(비동기 학습)
 * 	- CORS 허용 필요(프론트 도메인)
 * 	- FastAPI URL은 MlBridgeService에서 설정값으로 주입
 * ========================================================= */



@RestController
@RequestMapping("/api/forecast/ml")
public class ForecastMlController {

	private final MlBridgeService mlBridgeService;

	public ForecastMlController(MlBridgeService mlBridgeService) {
		this.mlBridgeService = mlBridgeService;
	}

	// [추가]
	// --------------------------------------------------------
	// API: 학습 시작
	// Method/Path:
	// 	POST /api/forecast/ml/train
	// 입력:
	// 	- 바디/쿼리 없음(현재 설계). 필요 시 서비스에서 공통 설정으로 학습.
	// 전제:
	// 	- FastAPI /train 엔드포인트 접근 가능
	// 동작:
	// 	1) 서비스에 비동기 학습 태스크를 위임(메모리 맵에 jobId 등록)
	// 	2) 즉시 jobId만 반환(학습은 백그라운드)
	// 출력:
	// 	- 200 OK + { jobId }
	// 	- 500 INTERNAL_SERVER_ERROR + { error } (시작 자체 실패 시)
	// 부작용:
	// 	- 서버 메모리에 jobId 상태가 생성됨
	// 예외:
	// 	- 서비스 내부 예외는 500으로 래핑
	@PostMapping("/train")
	public ResponseEntity<PredictDtos.TrainStartResponse> startTrain() {
		try {
			final String jobId = mlBridgeService.startTrainAsync();
			PredictDtos.TrainStartResponse rsp = new PredictDtos.TrainStartResponse();
			rsp.setJobId(jobId);
			return ResponseEntity.ok(rsp);
		} catch (Exception e) {
			return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
					.body(PredictDtos.TrainStartResponse.error("TRAIN_START_FAILED: " + e.getMessage()));
		}
	}

	// [추가]
	// --------------------------------------------------------
	// API: 학습 상태 조회
	// Method/Path:
	// 	GET /api/forecast/ml/train/status?jobId=...
	// 입력:
	// 	- jobId (필수, 학습 시작 시 받은 값)
	// 전제:
	// 	- 서버 메모리 맵에 해당 jobId가 존재해야 함
	// 동작:
	// 	1) 서비스에서 jobId 상태 조회
	// 	2) 상태 없으면 404, 있으면 200
	// 출력:
	// 	- 200 OK + { jobId, status(RUNNING|DONE|ERROR), progress?, message? }
	// 	- 404 NOT_FOUND + { jobId, status: NOT_FOUND, message }
	// 	- 500 INTERNAL_SERVER_ERROR + { status: ERROR, message }
	// 부작용:
	// 	- 없음(읽기)
	@GetMapping("/train/status")
	public ResponseEntity<PredictDtos.TrainStatusResponse> getTrainStatus(@RequestParam("jobId") String jobId) {
		try {
			MlBridgeService.TrainStatus status = mlBridgeService.getTrainStatus(jobId);
			if (status == null) {
				PredictDtos.TrainStatusResponse notFound = new PredictDtos.TrainStatusResponse();
				notFound.setJobId(jobId);
				notFound.setStatus("NOT_FOUND");
				notFound.setMessage("No such jobId");
				return ResponseEntity.status(HttpStatus.NOT_FOUND).body(notFound);
			}
			PredictDtos.TrainStatusResponse rsp = new PredictDtos.TrainStatusResponse();
			rsp.setJobId(jobId);
			rsp.setStatus(status.getStatus());
			rsp.setProgress(status.getProgress());
			rsp.setMessage(status.getMessage());
			return ResponseEntity.ok(rsp);
		} catch (Exception e) {
			PredictDtos.TrainStatusResponse err = new PredictDtos.TrainStatusResponse();
			err.setJobId(jobId);
			err.setStatus("ERROR");
			err.setMessage("STATUS_FAILED: " + e.getMessage());
			return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(err);
		}
	}

	// [추가]
	// --------------------------------------------------------
	// API: 예측
	// Method/Path:
	// 	POST /api/forecast/ml/predict?variant=C
	// 입력:
	// 	- 쿼리: variant (선택, 기본 C; A|B|C 중 하나)
	// 	- 바디: PredictRequest(JSON)
	// 		· type, region/regionRaw, builtYear, floorAreaM2
	// 		· energy_kwh/eui_kwh_m2y (옵션)
	// 		· yearsFrom/yearsTo, yearlyConsumption[], monthlyConsumption[] (옵션)
	// 전제:
	// 	- FastAPI /predict 사용 가능
	// 	- DTO 스키마가 FastAPI와 호환
	// 동작:
	// 	1) (안전) Type/Region 정규화
	// 	2) Service.predict() 호출 → FastAPI로 프록시
	// 출력:
	// 	- 200 OK + PredictResponse(JSON)
	// 	- 502 BAD_GATEWAY + { error } (하위 서버 오류)
	// 	- 500 INTERNAL_SERVER_ERROR + { error } (기타 실패)
	// 부작용:
	// 	- 없음(하위 서버 호출 외)
	@PostMapping("/predict")
	public ResponseEntity<PredictDtos.PredictResponse> predict(
			@RequestParam(name = "variant", required = false, defaultValue = "C") String variant,
			@RequestBody PredictDtos.PredictRequest request
	) {
		try {
			TypeRegionNormalizer.normalizeInPlace(request); // 방어적 전처리
			PredictDtos.PredictResponse rsp = mlBridgeService.predict(variant, request);
			return ResponseEntity.ok(rsp);
		} catch (MlBridgeService.DownstreamException de) {
			return ResponseEntity.status(HttpStatus.BAD_GATEWAY)
					.body(PredictDtos.PredictResponse.error("PREDICT_DOWNSTREAM: " + de.getMessage()));
		} catch (Exception e) {
			return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
					.body(PredictDtos.PredictResponse.error("PREDICT_FAILED: " + e.getMessage()));
		}
	}
}
