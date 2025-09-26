package com.example.co2.dto;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class SimulatorDto {
    private String address;
    private int area;
    private int energy;
    private Integer panelCount;   //Integer -> (null 허용)
    private Integer panelPower;   

  
}
