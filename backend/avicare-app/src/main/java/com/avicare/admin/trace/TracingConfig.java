package com.avicare.admin.trace;

import java.util.concurrent.Executor;
import java.util.concurrent.ThreadPoolExecutor;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.Ordered;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

/**
 * Wiring for request tracing.
 *
 * <p>The executor is deliberately small and deliberately lossy: one thread, a bounded queue, and
 * {@link ThreadPoolExecutor.DiscardPolicy} on saturation. Tracing must never be able to slow a
 * farmer's request down — {@code CallerRunsPolicy} would put the insert straight back on the
 * request thread, which is exactly what this whole design avoids. Under a burst we would rather
 * lose traces than serve requests more slowly; the discard is counted and logged by the recorder.
 */
@Configuration
@EnableAsync
@EnableConfigurationProperties(TracingProperties.class)
public class TracingConfig {

  public static final String EXECUTOR = "requestTraceExecutor";

  /**
   * Registers the trace filter just inside {@code CorrelationIdFilter}, so the correlation id is
   * already in the MDC, and outside Spring Security, so refused requests are traced too.
   */
  @Bean
  public FilterRegistrationBean<RequestTraceFilter> requestTraceFilterRegistration(
      RequestTraceRecorder recorder, TracingProperties properties) {
    FilterRegistrationBean<RequestTraceFilter> registration =
        new FilterRegistrationBean<>(new RequestTraceFilter(recorder, properties));
    registration.setOrder(Ordered.HIGHEST_PRECEDENCE + 10);
    return registration;
  }

  @Bean(EXECUTOR)
  public Executor requestTraceExecutor() {
    ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
    executor.setCorePoolSize(1);
    executor.setMaxPoolSize(2);
    executor.setQueueCapacity(500);
    executor.setThreadNamePrefix("req-trace-");
    executor.setRejectedExecutionHandler(new ThreadPoolExecutor.DiscardPolicy());
    // A shutdown must not wait on a backlog of debugging rows.
    executor.setWaitForTasksToCompleteOnShutdown(false);
    executor.initialize();
    return executor;
  }
}
