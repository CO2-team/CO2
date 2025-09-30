
package com.example.co2.service;

import com.example.co2.dto.SimulatorDto;
import com.example.co2.dto.SimulatorResultDto;
import com.example.co2.entity.TaxPolicy;
<<<<<<< Updated upstream
import com.example.co2.entity.ZebPolicy;
import com.example.co2.repository.TaxPolicyRepository;
import com.example.co2.repository.ZebPolicyRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import java.math.BigDecimal;
import java.math.RoundingMode;

=======
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

>>>>>>> Stashed changes
@Slf4j
@Service
@RequiredArgsConstructor
public class SimulatorService {
<<<<<<< Updated upstream

    private final TaxPolicyRepository taxPolicyRepository;
    private final ZebPolicyRepository zebPolicyRepository;

    public SimulatorResultDto calculate(SimulatorDto dto) throws Exception {
        SimulatorResultDto res = new SimulatorResultDto();
        

        BigDecimal annualUsage = dto.getEnergy();
        BigDecimal solarRadiation = getSolarRadiation(37.494,126.917);
        BigDecimal efficiency = BigDecimal.valueOf(0.8); 
        Integer panelPowerInt = dto.getPanelPower();
        Integer panelCountInt = dto.getPanelCount();
        BigDecimal panelPower = panelPowerInt == null ? BigDecimal.ZERO : BigDecimal.valueOf(panelPowerInt);
        BigDecimal panelCount = panelCountInt == null ? BigDecimal.ZERO : BigDecimal.valueOf(panelCountInt);
        BigDecimal generation = solarRadiation.multiply(efficiency).multiply(panelPower).multiply(panelCount).divide(BigDecimal.valueOf(1000));
        BigDecimal energySelf = generation.divide(annualUsage,3,RoundingMode.HALF_UP).multiply(BigDecimal.valueOf(100));
        System.out.println("generation = " + generation);
        System.out.println("energySelf = " + energySelf);
        BigDecimal usage = dto.getEnergy().divide(dto.getArea(),3,RoundingMode.HALF_UP); // 소수점 3자리 반올림
        System.out.println("usage = " + usage);

        ZebPolicy z = zebPolicyRepository
        .findFirstByMinPercentLessThanEqualAndMaxPercentGreaterThanEqual(energySelf, energySelf)
        .orElse(null);
       
        TaxPolicy p = taxPolicyRepository
                .findFirstByEnergyUsageMinLessThanEqualAndEnergyUsageMaxGreaterThanEqual(usage, usage)
                .orElse(null); // 스프링데이터 jpa의 파생쿼리
                                    // 구현을 쓰지않아도 메서드 이름으로 쿼리를 유추해서 알아서 구현해줌
=======

    private final TaxPolicyRepository taxPolicyRepository;

    public SimulatorResultDto calculate(SimulatorDto dto) {
        SimulatorResultDto res = new SimulatorResultDto();

        BigDecimal usage = dto.getEnergy().divide(dto.getArea(),3,RoundingMode.HALF_UP); // 소수점 3자리 반올림
        System.out.println("usage = " + usage);
       
        TaxPolicy p = taxPolicyRepository
                .findFirstByEnergyUsageMinLessThanEqualAndEnergyUsageMaxGreaterThanEqual(usage, usage)
                .orElse(null);
>>>>>>> Stashed changes
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
<<<<<<< Updated upstream
            res.setEnergySelf(energySelf);
        }
        if (z != null) {
            res.setZebGrade(z.getZebName());           // 등급명: 5등급, 4등급 …
            res.setPropertyTax(z.getTax1Discount());       // 취득세 같은 항목
            res.setAcquireTax(z.getTax2Discount());       // 재산세 같은 항목
            res.setRenewableSupport(z.getRenewableSupport()); // 보조금 설명
            res.setCertificationDiscount(z.getCertificationDiscount());
            res.setAreaBonus(z.getAreaBonus()); 
         
        } else {
            res.setZebGrade("등급없음");
        }


        return res;
    }


    public BigDecimal getSolarRadiation(double lat, double lon)throws Exception{
        String url = "https://power.larc.nasa.gov/api/temporal/monthly/point"
                  +  "?parameters=ALLSKY_SFC_SW_DWN"
                  +  "&community=RE"
                  +  "&latitude="+lat
                  +  "&longitude="+lon
                  +  "&start=2024"
                  +  "&end=2024"
                  +  "&format=JSON";
        RestTemplate nasaRestTemplate = new RestTemplate();
        String response = nasaRestTemplate.getForObject(url, String.class);
        System.out.println("response = " + response);
        ObjectMapper mapper = new ObjectMapper();
        JsonNode root = mapper.readTree(response);
        JsonNode values= root.path("properties").path("parameter").path("ALLSKY_SFC_SW_DWN");

        JsonNode annual = values.path("202413");
        System.out.println("annual = " + annual);
        if (annual.isMissingNode()||annual.isNull()) {
            throw new Exception("No data for the specified year");
        }

        BigDecimal annualmean = BigDecimal.valueOf(annual.asDouble()).setScale(3, RoundingMode.HALF_UP);
        BigDecimal result = annualmean.multiply(BigDecimal.valueOf(366));

        return result;
    }   
   
=======
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
>>>>>>> Stashed changes
        
    
}

