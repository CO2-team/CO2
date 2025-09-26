package com.example.co2.controller;

import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.*;

@Controller
public class ForecastPageController {

    @GetMapping("/forecast/{id}")
    public String viewForecast(@PathVariable Long id, Model model) {
        model.addAttribute("buildingId", id);
        return "html/forecast";
    }
}
