package com.example.co2.page;

import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;

@Controller
@RequestMapping("/forecast") // 페이지 prefix 고정
public class ForecastPageController {

    // /forecast : id 없이 열기 = 더미/시나리오로 모드
    @GetMapping({"","/"})
    public String viewNoId(
            @RequestParam(defaultValue = "2024") int from,
            @RequestParam(defaultValue = "2024") int to,
            Model model
    ) {
        model.addAttribute("buildingId", null);
        model.addAttribute("fromYear", from);
        model.addAttribute("toYear", to);
        return "html/forecast"; // templates/html/forecast.html
    }

    // /forecast/{id} : id로 열기
    @GetMapping("/{id}")
    public String viewWitId(
            @PathVariable Long id,
            @RequestParam(defaultValue = "2024") int from,
            @RequestParam(defaultValue = "2030") int to,
            Model model
    ) {
        model.addAttribute("buildingId", id);
        model.addAttribute("fromYear", from);
        model.addAttribute("toYear", to);
        return "html/forecast";
    }
}
