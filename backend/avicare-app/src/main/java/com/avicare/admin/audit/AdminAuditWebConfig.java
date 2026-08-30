package com.avicare.admin.audit;

import com.avicare.admin.trace.RequestTraceInterceptor;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * Registers the staff mutation audit interceptor and the request-trace enricher across every route.
 *
 * <p><b>Note for slice tests.</b> {@code @WebMvcTest} loads every {@link WebMvcConfigurer} but no
 * {@code @Service}, so any slice will fail on the missing {@code AdminAuditService} until it
 * declares a {@code @MockitoBean} for it. The dependency is kept hard on purpose: an audit
 * component that quietly turns itself off when a bean is absent is worse than one that fails
 * loudly.
 */
@Configuration
@RequiredArgsConstructor
public class AdminAuditWebConfig implements WebMvcConfigurer {

  private final AdminMutationAuditInterceptor auditInterceptor;

  @Override
  public void addInterceptors(InterceptorRegistry registry) {
    // No path restriction on purpose: the whole point is to cover the tenant API too.
    registry.addInterceptor(auditInterceptor);
    // Runs on every route as well: it only reads the security context to enrich the trace the
    // outer filter is about to write.
    registry.addInterceptor(new RequestTraceInterceptor());
  }
}
