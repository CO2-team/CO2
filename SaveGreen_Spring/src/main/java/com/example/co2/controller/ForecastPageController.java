package com.example.co2.controller;

import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.*;

@Controller
public class ForecastPageController {

    @GetMapping("/buildings/{buildingId}/forecast/view")
    public String showForecastPage(@PathVariable Long buildingId, Model model) {
        model.addAttribute("buildingId", buildingId);
        return "buildings/forecast";
    }
}
