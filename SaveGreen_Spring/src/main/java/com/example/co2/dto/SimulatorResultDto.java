package com.example.co2.dto;


import java.math.BigDecimal;


// import lombok.Getter;
// import lombok.Setter;

// @Getter
// @Setter
// public class SimulatorResultDto {
//     private String grade;
//     private String greenGrade;
//     private int energySelf;
//     private String zebGrade;
//     private int propertyTax; // 재산세
//     private int acquireTax; // 취득세
//     private int areaBonus; // 용적률
// }

import lombok.Getter;
import lombok.Setter;

@Getter @Setter
public class SimulatorResultDto {
    // 아직 미정인 값들은 빈칸/0으로 내려도 됨
    private String grade;        // 에너지 효율 등급 (추후 계산)
  

    private BigDecimal energySelf;  // 자립도 % (추후)

    private String zebGrade;     // ZEB 등급 (추후)

    // TAX (DB에서 매칭)
    private Integer propertyTax; // 재산세 감면  ← tax1_discount
    private Integer acquireTax;  // 취득세 감면  ← tax2_discount
    private Integer areaBonus;   // 기준 완화     ← area_bonus

    private String renewableSupport; // 신재생에너지 지원 (ZEB 정책에서)
    private Integer certificationDiscount; // 인증제 감면 (ZEB 정책에서)
    private String message;      // 안내/오류 메시지
    private String zebName;      // ZEB 등급 이름 (추가)

    private String category;    // 에너지 효율 등급 카테고리 (추가)
}
