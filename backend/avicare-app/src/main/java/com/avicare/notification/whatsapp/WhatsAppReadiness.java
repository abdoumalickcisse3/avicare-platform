package com.avicare.notification.whatsapp;

import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Whether this instance can actually send a WhatsApp message, said out loud at startup.
 *
 * <p>The failure this guards against is not a crash — it is silence. Two switches must both be on:
 * the feature flag, and a Konekt secret. Miss either and notifications pile up in the bell, the
 * outbox stays full, no exception is thrown, and everything looks normal. On a platform whose
 * headline promise is "you will be told", that is the worst possible failure mode: it cannot be
 * noticed from the inside.
 *
 * <p>So the state is logged once, at boot, in terms an operator can act on — and a blank secret
 * stops the dispatcher rather than burning all five attempts of every queued row against a gateway
 * that will refuse them. Rows keep queueing: when the secret finally arrives, nothing has been
 * lost.
 *
 * <p>The secret itself is never logged, only whether one is present.
 */
@Component
@Slf4j
public class WhatsAppReadiness {

  private final boolean enabled;
  private final boolean secretPresent;

  public WhatsAppReadiness(
      @Value("${notifications.whatsapp.enabled:false}") boolean enabled,
      @Value("${konekt.api-secret:}") String apiSecret) {
    this.enabled = enabled;
    this.secretPresent = apiSecret != null && !apiSecret.isBlank();
  }

  /** Both switches are on: a message handed to the dispatcher has somewhere to go. */
  public boolean canSend() {
    return enabled && secretPresent;
  }

  public boolean isEnabled() {
    return enabled;
  }

  public boolean isSecretPresent() {
    return secretPresent;
  }

  @PostConstruct
  void announce() {
    if (canSend()) {
      log.info("WhatsApp notifications: ENABLED, Konekt secret present — messages will be sent.");
    } else if (!enabled) {
      log.warn(
          "WhatsApp notifications are DISABLED (notifications.whatsapp.enabled=false). "
              + "Alerts will appear in the app only; no message will be sent.");
    } else {
      log.error(
          "WhatsApp notifications are ENABLED but KONEKT_API_SECRET is blank. "
              + "Nothing will be sent and the outbox will grow. Set the secret in the VPS "
              + "environment, or set NOTIF_WHATSAPP_ENABLED=false to stop queueing alerts.");
    }
  }
}
