package com.example.co2;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableAsync;

@SpringBootApplication
@EnableAsync
public class Co2Application {

	public static void main(String[] args) {
		SpringApplication.run(Co2Application.class, args);
	}

}
