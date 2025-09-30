package com.example.co2.controller;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;



@Controller
public class ServiceController {

    @GetMapping("/service")
    public String getServicePage() {
        return "html/serviceMap";
        
    }

    @GetMapping("/service/text")
    public String getTextPage() {
        return "html/serviceText";
        
    }
    
    
}
