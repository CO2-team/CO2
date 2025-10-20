// src/main/java/com/example/co2/util/TypeRegionNormalizer.java
// ============================================================================
// SaveGreen / TypeRegionNormalizer
// ----------------------------------------------------------------------------
// [역할]
// - FE/스프링에서 들어오는 type/region 문자열을 FastAPI 모델에서 기대하는
//   표준 값으로 정규화한다.
// ----------------------------------------------------------------------------
// [스코프/정책]
// - type: {factory, hospital, school, office} 중 하나로 귀결(키워드 매핑).
// - region: 데모 단계에서는 'daejeon'으로 고정.
// - 매칭 실패시 디폴트 'office'로 폴백(시연 안정성 우선).
// ============================================================================

package com.example.co2.util;

import org.springframework.stereotype.Component;

@Component
public class TypeRegionNormalizer {

	/**
	 * 건물 타입 문자열을 표준값으로 변환
	 * - 하위/혼합 입력(예: "공장", "factory building")도 키워드 매칭
	 * - 실패 시 "office"
	 */
	public String normalizeType(String raw) {
		if (raw == null) return "office";
		String s = raw.trim().toLowerCase();

		// 간단 키워드 매핑(필요 시 사전 확장)
		if (s.contains("factory") || s.contains("공장")) return "factory";
		if (s.contains("hospital") || s.contains("병원")) return "hospital";
		if (s.contains("school") || s.contains("학교")) return "school";
		if (s.contains("office") || s.contains("사무") || s.contains("업무")) return "office";

		// 디폴트
		return "office";
	}

	/**
	 * 지역 정규화
	 * - 데모: 입력 무관 'daejeon'로 고정
	 * - 확장: 행정구역 코드/지도 API 연동하여 결정
	 */
	public String normalizeRegion(String raw) {
		return "daejeon";
	}
}
