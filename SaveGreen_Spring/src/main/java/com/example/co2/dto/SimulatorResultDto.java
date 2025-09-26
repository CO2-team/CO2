package com.example.co2.dto;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class SimulatorResultDto {
    private String grade;
    private String greenGrade;
    private int energySelf;
    private String zebGrade;
    private int propertyTax; // 재산세
    private int acquireTax; // 취득세
    private int areaBonus; // 용적률
}
