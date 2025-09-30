package com.example.co2.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.ResponseBody;
import com.example.co2.dto.SimulatorDto;
import com.example.co2.dto.SimulatorResultDto;
import com.example.co2.service.SimulatorService;

@Controller
public class SimulatorController {
    @GetMapping("/simulator")
    public String simulator() {
        return "html/simulator"; // templates/simulator.html 렌더링
    }
    @Autowired  
    private SimulatorService simulatorService;

    @PostMapping("/simulate")
    @ResponseBody
    public SimulatorResultDto simulate(@ModelAttribute SimulatorDto dto) throws Exception { 
        System.out.println(  dto.getLat()  + dto.getLon());
        return simulatorService.calculate(dto);
        
}

}
