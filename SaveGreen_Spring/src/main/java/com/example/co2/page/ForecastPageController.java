package com.example.co2.page;

import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.*;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@Controller
@RequestMapping("/forecast") // 페이지 prefix 고정
public class ForecastPageController {

    // /forecast : id 없이 열기 = 더미/시나리오 모드
    @GetMapping({"", "/"})
    public String viewNoId(
        @RequestParam(defaultValue = "2024") int from,
        @RequestParam(defaultValue = "2024") int to,
        @RequestParam(required = false) Integer builtYear,
        @RequestParam(required = false) String pnu,
        @RequestParam(required = false) String useName,
        @RequestParam(required = false) Double area,
        @RequestParam(required = false) Double plotArea,
        @RequestParam(required = false) Integer floorsAbove,
        @RequestParam(required = false) Integer floorsBelow,
        @RequestParam(required = false) Double height,
        @RequestParam(required = false) String approvalDate,
        @RequestParam(required = false) String buildingName,
        @RequestParam(required = false) String dongName,
        @RequestParam(required = false) String buildingIdent,
        @RequestParam(required = false) String lotSerial,
        Model model
    ) {
        // id 없음 → 빈 문자열로 내려서 data-bid=""
        model.addAttribute("buildingId", "");
        model.addAttribute("fromYear", from);
        model.addAttribute("toYear", to);
        model.addAttribute("builtYear", builtYear); // null이면 그대로 둠

        if (pnu != null && !pnu.isBlank())                      model.addAttribute("pnu", pnu);
        if (useName != null && !useName.isBlank())              model.addAttribute("useName", useName);
        if (area != null && area > 0)                           model.addAttribute("area", area);
        if (plotArea != null && plotArea > 0)                   model.addAttribute("plotArea", plotArea);
        if (floorsAbove != null && floorsAbove >= 0)            model.addAttribute("floorsAbove", floorsAbove);
        if (floorsBelow != null && floorsBelow >= 0)            model.addAttribute("floorsBelow", floorsBelow);
        if (height != null && height > 0)                       model.addAttribute("height", height);
        if (approvalDate != null && !approvalDate.isBlank())    model.addAttribute("approvalDate", approvalDate);
        if (buildingName != null && !buildingName.isBlank())    model.addAttribute("buildingName", buildingName);
        if (dongName != null && !dongName.isBlank())            model.addAttribute("dongName", dongName);
        if (buildingIdent != null && !buildingIdent.isBlank())  model.addAttribute("buildingIdent", buildingIdent);
        if (lotSerial != null && !lotSerial.isBlank())          model.addAttribute("lotSerial", lotSerial);

        return "html/forecast"; // templates/html/forecast.html
    }

    // /forecast/{id} : id로 열기
    @GetMapping("/{id}")
    public String viewWithId(
            @PathVariable Long id,
            @RequestParam(defaultValue = "2024") int from,
            @RequestParam(defaultValue = "2030") int to,
            @RequestParam(required = false) Integer builtYear,
            @RequestParam(required = false) String pnu,
            @RequestParam(required = false) String useName,
            @RequestParam(required = false) Double area,
            @RequestParam(required = false) Double plotArea,
            @RequestParam(required = false) Integer floorsAbove,
            @RequestParam(required = false) Integer floorsBelow,
            @RequestParam(required = false) Double height,
            @RequestParam(required = false) String approvalDate,
            @RequestParam(required = false) String buildingName,
            @RequestParam(required = false) String dongName,
            @RequestParam(required = false) String buildingIdent,
            @RequestParam(required = false) String lotSerial,
            Model model
    ) {
        log.info("PAGE /forecast id = {}, builtYear = {}, pnu = {}", id, builtYear, pnu);
        model.addAttribute("buildingId", id); // 숫자 그대로
        model.addAttribute("fromYear", from);
        model.addAttribute("toYear", to);
        model.addAttribute("builtYear", builtYear);

        if (pnu != null && !pnu.isBlank())                      model.addAttribute("pnu", pnu);
        if (useName != null && !useName.isBlank())              model.addAttribute("useName", useName);
        if (area != null && area > 0)                           model.addAttribute("area", area);
        if (plotArea != null && plotArea > 0)                   model.addAttribute("plotArea", plotArea);
        if (floorsAbove != null && floorsAbove >= 0)            model.addAttribute("floorsAbove", floorsAbove);
        if (floorsBelow != null && floorsBelow >= 0)            model.addAttribute("floorsBelow", floorsBelow);
        if (height != null && height > 0)                       model.addAttribute("height", height);
        if (approvalDate != null && !approvalDate.isBlank())    model.addAttribute("approvalDate", approvalDate);
        if (buildingName != null && !buildingName.isBlank())    model.addAttribute("buildingName", buildingName);
        if (dongName != null && !dongName.isBlank())            model.addAttribute("dongName", dongName);
        if (buildingIdent != null && !buildingIdent.isBlank())  model.addAttribute("buildingIdent", buildingIdent);
        if (lotSerial != null && !lotSerial.isBlank())          model.addAttribute("lotSerial", lotSerial);
        return "html/forecast";
    }
}
