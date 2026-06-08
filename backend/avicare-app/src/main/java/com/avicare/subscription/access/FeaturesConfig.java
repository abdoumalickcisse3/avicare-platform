package com.avicare.subscription.access;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;

/** Activates constructor-binding for {@link FeaturesProperties}. */
@Configuration
@EnableConfigurationProperties(FeaturesProperties.class)
public class FeaturesConfig {}
