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

  /** Au-delà, un nom n'informe plus : il encombre un message lu sur un téléphone. */
  private static final int NOM_MAX = 60;

  private static final int EMAIL_MAX = 80;
  private static final int PHONE_MAX = 24;

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
    String nom = aplatir(fullName, NOM_MAX);
    String adresse = aplatir(email, EMAIL_MAX);
    String numero = aplatir(phone, PHONE_MAX);
    whatsApp.enqueue(
        onCallPhone,
        "🌱 Jawdi — nouvelle inscription : « "
            + nom
            + " » ("
            + adresse
            + ("—".equals(numero) ? "" : ", " + numero)
            + "). Compte actif immédiatement.");
  }

  /**
   * Rend une valeur saisie par l'inscrit affichable dans un message que l'astreinte lit comme digne
   * de confiance.
   *
   * <p>L'inscription est publique : {@code fullName} est du texte libre de deux cents caractères.
   * Tel quel, un retour à la ligne y fabrique une ligne de plus — « ✅ Vérifié par Jawdi », un lien,
   * ce que l'auteur veut — dans un message dont le lecteur ne doute pas. On aplatit donc tout ce
   * qui pourrait en casser la structure, et on borne la longueur : au-delà, un nom n'informe plus,
   * il encombre.
   *
   * <p>Ce que ça ne fait pas : empêcher WhatsApp de rendre cliquable une adresse écrite dans un
   * nom. Les guillemets sont là pour ça — le lecteur voit où le champ commence et où il finit, et
   * un lien à l'intérieur se lit comme ce qu'il est, le texte qu'un inconnu a tapé.
   */
  private static String aplatir(String valeur, int max) {
    if (valeur == null || valeur.isBlank()) {
      return "—";
    }
    StringBuilder sansControle = new StringBuilder(valeur.length());
    valeur
        .codePoints()
        .forEach(c -> sansControle.appendCodePoint(Character.isISOControl(c) ? ' ' : c));
    String plat = sansControle.toString().replaceAll("\\s+", " ").trim();
    if (plat.isEmpty()) {
      return "—";
    }
    return plat.length() <= max ? plat : plat.substring(0, max) + "…";
  }
}
