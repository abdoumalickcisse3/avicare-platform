package com.avicare.notification.whatsapp;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class WhatsAppReadinessTest {

  @Test
  @DisplayName("both switches on: messages can be sent")
  void enabledWithSecretCanSend() {
    WhatsAppReadiness readiness = new WhatsAppReadiness(true, "a-secret");

    assertThat(readiness.canSend()).isTrue();
    assertThat(readiness.isEnabled()).isTrue();
    assertThat(readiness.isSecretPresent()).isTrue();
  }

  @Test
  @DisplayName("enabled but no secret: cannot send, and the outbox is spared five doomed attempts")
  void enabledWithoutSecretCannotSend() {
    assertThat(new WhatsAppReadiness(true, "").canSend()).isFalse();
    assertThat(new WhatsAppReadiness(true, "   ").canSend()).isFalse();
    assertThat(new WhatsAppReadiness(true, null).canSend()).isFalse();
  }

  @Test
  @DisplayName("a secret alone sends nothing while the flag is off")
  void secretWithoutFlagCannotSend() {
    WhatsAppReadiness readiness = new WhatsAppReadiness(false, "a-secret");

    assertThat(readiness.canSend()).isFalse();
    assertThat(readiness.isSecretPresent()).isTrue();
  }

  @Test
  @DisplayName("announcing the state never throws, whatever the combination")
  void announceIsSafe() {
    new WhatsAppReadiness(true, "s").announce();
    new WhatsAppReadiness(true, "").announce();
    new WhatsAppReadiness(false, "").announce();
  }
}
