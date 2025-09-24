package main.java.com.example.co2;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
public class mainController {

    @GetMapping("/")
    public String main() {
        return "index"; // templates/index.html 렌더링
    }
    
}
