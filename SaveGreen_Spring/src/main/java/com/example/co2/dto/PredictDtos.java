// src/main/java/com/example/co2/dto/PredictDtos.java
// ============================================================================
// SaveGreen / PredictDtos
// ----------------------------------------------------------------------------
// [역할]
// - FastAPI /predict 입력/출력 DTO 정의.
// - 스키마는 FastAPI(schema.py)의 PredictRequest/Response와 필드명을 일치시킨다.
// ----------------------------------------------------------------------------
// [주의]
// - 키 이름(energy_kwh, eui_kwh_m2y 등)은 파이썬 단과 동일해야 직렬화가 정확히 맞음.
// - null 허용 필드는 NPE 방지를 위해 박싱 타입(Double/Integer) 사용.
// ============================================================================

package com.example.co2.dto;

import lombok.Data;

@Data
public class PredictDtos {

	// ---------- 요청 DTO ----------
	@Data
	public static class PredictRequest {
		// 타입(예: factory/hospital/school/office) — 정규화 유틸로 정리
		private String type;

		// 지역(데모: 'daejeon' 고정). 추후 확장 시 정규화
		private String region;

		// 연간 전력 사용량(kWh/년)
		private Double energy_kwh;

		// 전력 EUI(kWh/㎡·년)
		private Double eui_kwh_m2y;

		// 준공연도
		private Integer builtYear;

		// 연면적(㎡)
		private Double floorAreaM2;
	}

	// ---------- 응답 DTO ----------
	@Data
	public static class PredictResponse {
		// 절감량(kWh/년)
		private Double savingKwhYr;

		// 비용 절감(원/년)
		private Double savingCostYr;

		// 절감률(%)
		private Double savingPct;

		// 투자 회수기간(년)
		private Double paybackYears;

		// 레이블(RECOMMEND/CONDITIONAL/NOT_RECOMMEND)
		private String label;
	}
}
