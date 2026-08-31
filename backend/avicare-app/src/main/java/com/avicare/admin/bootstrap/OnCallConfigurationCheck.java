package com.avicare.admin.bootstrap;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

/**
 * Says at startup whether urgent platform alerts have anywhere to go.
 *
 * <p>Two mechanisms raise them — the kill switch (P3) and the integrity checks (P2) — and both fall
 * back to writing the audit trail and nothing else when no number is configured. That is a
 * reasonable fallback and a terrible surprise: without this line, the gap is discovered on the
 * night something breaks, by the silence.
 *
 * <p>Only a warning. A platform with nobody on call must still boot — a farm's data does not stop
 * mattering because we forgot an environment variable.
 */
@Component
@Slf4j
public class OnCallConfigurationCheck {

  @Value("${avicare.admin.oncall-phone:}")
  private String onCallPhone;

  @EventListener(ApplicationReadyEvent.class)
  public void report() {
    if (onCallPhone == null || onCallPhone.isBlank()) {
      log.warn(
          "ADMIN_ONCALL_PHONE is not set — kill-switch and data-integrity alerts will be recorded"
              + " in the audit trail but sent to nobody. Set it in infra/.env to receive them.");
    } else {
      log.info("On-call alerts will be sent to the configured number");
    }
  }
}
