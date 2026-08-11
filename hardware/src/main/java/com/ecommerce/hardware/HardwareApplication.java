package com.ecommerce.hardware;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class HardwareApplication {

	public static void main(String[] args) {
		SpringApplication.run(HardwareApplication.class, args);
	}

}
