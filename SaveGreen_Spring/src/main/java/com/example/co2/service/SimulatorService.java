package com.example.co2.service;

import com.example.co2.dto.SimulatorDto;
import com.example.co2.dto.SimulatorResultDto;
import org.springframework.stereotype.Service;

@Service
public class SimulatorService {

    public SimulatorResultDto calculate(SimulatorDto dto) {
        SimulatorResultDto result = new SimulatorResultDto();

        // 👉 여기서 DB 조회 + 계산 처리
        result.setGrade("1등급");
        result.setGreenGrade("녹색건축물");
        result.setEnergySelf(75);
        result.setZebGrade("ZEB 인증");
        result.setPropertyTax(10);
        result.setAcquireTax(20);
        result.setAreaBonus(15);  
        return result;
    }
}
