package com.avicare.common.security.config;

import com.avicare.common.security.jwt.JwtProperties;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;

/** Activates constructor-binding for {@link JwtProperties}. */
@Configuration
@EnableConfigurationProperties(JwtProperties.class)
public class JwtConfig {}
