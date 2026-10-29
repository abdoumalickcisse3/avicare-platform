package com.avicare.admin.audit;

import com.avicare.admin.service.AdminAuditService;
import com.avicare.identity.spi.SignupAlerter;
import com.avicare.notification.api.WhatsAppOutboxFacade;
import java.util.HashMap;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Côté back-office de {@link SignupAlerter} : une inscription rejoint la main courante, et réveille
 * qui est d'astreinte.
 *
 * <p>Même forme que {@link AdminIntegrityAlerter}, et pour la même raison : le contexte qui
 * constate l'événement n'a pas à importer celui qui tient le journal d'audit et possède le rail
 * WhatsApp.
 *
 * <p>Sans numéro d'astreinte configuré, l'inscription est quand même journalisée : la trace vaut
 * d'être gardée même quand personne n'est joignable.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class SignupAlerterImpl implements SignupAlerter {

  private final AdminAuditService auditService;
  private final WhatsAppOutboxFacade whatsApp;

  @Value("${avicare.admin.oncall-phone:}")
  private String onCallPhone;

  @Override
  public void accountCreated(Long userId, String fullName, String email, String phone) {
    Map<String, Object> metadata = new HashMap<>();
    metadata.put("email", email);
    metadata.put("phone", phone);
    metadata.put("automatic", true);
    auditService.record(userId, "signup.created", "User", userId, null, metadata);

    if (onCallPhone == null || onCallPhone.isBlank()) {
      log.warn("New signup (user {}) — no on-call phone configured, nobody was told", userId);
      return;
    }
    whatsApp.enqueue(
        onCallPhone,
        "🌱 Jawdi — nouvelle inscription : "
            + fullName
            + " ("
            + email
            + (phone == null || phone.isBlank() ? "" : ", " + phone)
            + "). Compte actif immédiatement.");
  }
}
