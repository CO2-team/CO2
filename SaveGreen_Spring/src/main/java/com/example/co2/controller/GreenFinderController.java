package com.example.co2.controller;

import org.springframework.stereotype.Controller;

import com.example.co2.dto.AddressDto;
import com.example.co2.dto.SearchBuilding;
import com.example.co2.service.GreenFinderService;
import com.example.co2.service.SearchBuildingJsonService;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestTemplate;

import java.util.List;

@CrossOrigin
@Controller
public class GreenFinderController {
/**dddddgit */
    private final GreenFinderService greenFinderService;
    
    private final SearchBuildingJsonService searchBuildingJsonService; // dummy data service
    
    public GreenFinderController(GreenFinderService greenFinderService, SearchBuildingJsonService searchBuildingJsonService) {
        this.greenFinderService = greenFinderService;
        this.searchBuildingJsonService = searchBuildingJsonService;
    }

    @GetMapping("/GreenFinder")
    public String getServicePage() {
        return "html/GreenFinderMap";
    }

    @GetMapping("/GreenFinder/text")
    public String getTextPage() {
        return "html/serviceText";
    }

    @GetMapping("/GreenFinder/search")
    @ResponseBody
    public ResponseEntity<List<AddressDto>> search(@RequestParam("keyword") String keyword) {
        List<AddressDto> result = greenFinderService.searchAddress(keyword);
        return ResponseEntity.ok(result);
    }

    @GetMapping("/GreenFinder/energyCheck")
    public String getGreenCheck() {
        return "html/energyUseCheck";
    }


    @GetMapping("/GreenFinder/energyCheck/{pnu}")
    @ResponseBody
    public ResponseEntity<?> getByPnu(@PathVariable String pnu) {
        SearchBuilding found = searchBuildingJsonService.findByPnu(pnu);
        if (found == null) {
            return ResponseEntity.status(404).body("[에너지데이터없음]");
        }
        return ResponseEntity.ok(found);
    }

}