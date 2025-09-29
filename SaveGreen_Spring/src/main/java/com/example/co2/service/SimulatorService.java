
package com.example.co2.service;

import com.example.co2.dto.SimulatorDto;
import com.example.co2.dto.SimulatorResultDto;
import com.example.co2.entity.TaxPolicy;
import com.example.co2.repository.TaxPolicyRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;

@Slf4j
@Service
@RequiredArgsConstructor
public class SimulatorService {

    private final TaxPolicyRepository taxPolicyRepository;

    public SimulatorResultDto calculate(SimulatorDto dto) {
        SimulatorResultDto res = new SimulatorResultDto();

        BigDecimal usage = dto.getEnergy().divide(dto.getArea(),3,RoundingMode.HALF_UP); // 소수점 3자리 반올림
        System.out.println("usage = " + usage);
       
        TaxPolicy p = taxPolicyRepository
                .findFirstByEnergyUsageMinLessThanEqualAndEnergyUsageMaxGreaterThanEqual(usage, usage)
                .orElse(null);
        System.out.println("p = " + p);
        if (p == null) {
            res.setPropertyTax(0);
            res.setAcquireTax(0);
            res.setAreaBonus(0);
           
        } else {
            res.setPropertyTax(p.getTax1Discount());
            res.setAcquireTax(p.getTax2Discount());
            res.setAreaBonus(p.getAreaBonus());
            res.setGrade(p.getEnergyGradeLabel());
            res.setCategory(p.getEnergyGradeCategory());
        }
        return res;
    }
    // private final RestTemplate nasaRestTemplate;
    // public SimulatorService(RestTemplateBuilder builder,TaxPolicyRepository taxPolicyRepository) {
    //    this.taxPolicyRepository = taxPolicyRepository;
    //    this.nasaRestTemplate= builder.connectTimeout(Duration.ofSeconds(5))
    //            .readTimeout(Duration.ofSeconds(10))
    //            .build();
        
    // }
        
    
}

