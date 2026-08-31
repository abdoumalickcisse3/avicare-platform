package com.avicare.threat.service;

import com.avicare.common.api.web.ClientIp;
import com.avicare.identity.spi.LoginAttemptListener;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

/**
 * Feeds sign-in outcomes to the detector, with the address they came from.
 *
 * <p>Never throws. Authentication must keep working even if the detector cannot write — the point
 * of this is to make attacks expensive, not to make sign-in fragile.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class ThreatLoginAttemptListener implements LoginAttemptListener {

  private final ThreatDetectionService threatDetection;

  @Override
  public void loginFailed(String email) {
    currentRequest()
        .ifPresent(
            attributes -> {
              try {
                threatDetection.recordFailedLogin(
                    ClientIp.of(attributes.getRequest()),
                    email,
                    attributes.getRequest().getHeader("User-Agent"));
              } catch (RuntimeException e) {
                log.error("Could not record a failed login attempt", e);
              }
            });
  }

  @Override
  public void accountCreated(String email) {
    currentRequest()
        .ifPresent(
            attributes -> {
              try {
                threatDetection.recordSignup(ClientIp.of(attributes.getRequest()), email);
              } catch (RuntimeException e) {
                log.error("Could not record a signup", e);
              }
            });
  }

  /** Empty outside a request — a provisioning script is not an attempt to break in. */
  private static java.util.Optional<ServletRequestAttributes> currentRequest() {
    return RequestContextHolder.getRequestAttributes()
            instanceof ServletRequestAttributes attributes
        ? java.util.Optional.of(attributes)
        : java.util.Optional.empty();
  }
}
