package com.avicare;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.actuate.autoconfigure.security.servlet.ManagementWebSecurityAutoConfiguration;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.security.servlet.SecurityAutoConfiguration;

// Spring Security is on the classpath (common-security skeleton, A2 will
// fill it in). Until then, exclude both the core security auto-config and
// the actuator-specific one (which depends on HttpSecurity provided by
// the former) so /actuator endpoints respond unauthenticated. Removed at
// Sprint A2/A3 when the real JwtFilter / SecurityFilterChain land.
@SpringBootApplication(
    exclude = {SecurityAutoConfiguration.class, ManagementWebSecurityAutoConfiguration.class})
public class AvicareApplication {

    public static void main(String[] args) {
        SpringApplication.run(AvicareApplication.class, args);
    }
}
