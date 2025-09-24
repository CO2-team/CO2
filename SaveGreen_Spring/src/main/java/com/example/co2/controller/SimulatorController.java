package com.example.co2.controller;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
public class SimulatorController {
    @GetMapping("/simulator")
    public String simulator() {
        return "html/simulator"; // templates/simulator.html 렌더링
    }

}
