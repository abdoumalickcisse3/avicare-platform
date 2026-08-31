package com.avicare.admin.bootstrap;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

/**
 * Says at startup whether the platform's two out-of-band channels have anywhere to go.
 *
 * <p>Two mechanisms raise them — the kill switch (P3) and the integrity checks (P2) — and both fall
 * back to writing the audit trail and nothing else when no number is configured. That is a
 * reasonable fallback and a terrible surprise: without this line, the gap is discovered on the
 * night something breaks, by the silence.
 *
 * <p>The emergency contact is a different number and a different purpose: the on-call is the
 * operator, and the emergency contact is who gets told when the operator himself goes quiet. A
 * platform run by one person needs both, and neither is discoverable by looking at the app.
 *
 * <p>Only warnings. A platform with nobody on call must still boot — a farm's data does not stop
 * mattering because we forgot an environment variable.
 */
@Component
@Slf4j
public class OnCallConfigurationCheck {

  @Value("${avicare.admin.oncall-phone:}")
  private String onCallPhone;

  @Value("${avicare.admin.emergency-phone:}")
  private String emergencyPhone;

  @EventListener(ApplicationReadyEvent.class)
  public void report() {
    if (isBlank(onCallPhone)) {
      log.warn(
          "ADMIN_ONCALL_PHONE is not set — kill-switch, data-integrity and intrusion alerts will be"
              + " recorded in the audit trail but sent to nobody. Set it in infra/.env.");
    } else {
      log.info("On-call alerts will be sent to the configured number");
    }

    if (isBlank(emergencyPhone)) {
      log.warn(
          "ADMIN_EMERGENCY_PHONE is not set — if the platform owner goes quiet for days, nobody"
              + " will be told. See docs/continuity/.");
    } else {
      log.info("An emergency contact is configured for the continuity watch");
    }
  }

  private static boolean isBlank(String value) {
    return value == null || value.isBlank();
  }
}
