package com.example.co2.page;

import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.*;

@Controller
@RequestMapping("/forecast") // 페이지 prefix 고정
public class ForecastPageController {

    // /forecast : id 없이 열기 = 더미/시나리오 모드
    @GetMapping({"", "/"})
    public String viewNoId(
            @RequestParam(defaultValue = "2024") int from,
            @RequestParam(defaultValue = "2024") int to,
            @RequestParam(required = false) Integer builtYear,
            Model model
    ) {
        // id 없음 → 빈 문자열로 내려서 data-bid=""
        model.addAttribute("buildingId", "");
        model.addAttribute("fromYear", from);
        model.addAttribute("toYear", to);
        model.addAttribute("builtYear", builtYear); // null이면 그대로 둠
        return "html/forecast"; // templates/html/forecast.html
    }

    // /forecast/{id} : id로 열기
    @GetMapping("/{id}")
    public String viewWithId(
            @PathVariable Long id,
            @RequestParam(defaultValue = "2024") int from,
            @RequestParam(defaultValue = "2030") int to,
            @RequestParam(required = false) Integer builtYear,
            Model model
    ) {
        model.addAttribute("buildingId", id); // 숫자 그대로
        model.addAttribute("fromYear", from);
        model.addAttribute("toYear", to);
        model.addAttribute("builtYear", builtYear);
        return "html/forecast";
    }
}
