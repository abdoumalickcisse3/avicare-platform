package com.avicare;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class AvicareApplication {

  public static void main(String[] args) {
    SpringApplication.run(AvicareApplication.class, args);
  }
}
