package com.avicare.admin.audit;

import com.avicare.admin.service.AdminAuditService;
import com.avicare.identity.spi.SignupAlerter;
import com.avicare.notification.api.WhatsAppOutboxFacade;
import java.util.HashMap;
import java.util.Map;
import java.util.regex.Pattern;
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

  /**
   * Tout ce qui est invisible et pourtant structurant : contrôles C0/C1 (Cc), caractères de format
   * et marques bidirectionnelles (Cf), séparateurs de ligne et de paragraphe (Zl, Zp).
   *
   * <p>{@code Character.isISOControl} ne voyait que les premiers. U+2028 est une fin de ligne pour
   * certains clients et U+202E retourne le sens de lecture : ni l'un ni l'autre n'est un « ISO
   * control », et tous deux cassent la structure d'un message.
   */
  private static final Pattern INVISIBLES = Pattern.compile("[\\p{Cc}\\p{Cf}\\p{Zl}\\p{Zp}]");

  /**
   * Les guillemets qui encadrent le nom, et les marques de mise en forme de WhatsApp.
   *
   * <p>Un délimiteur est dans le clavier de celui qui s'inscrit : s'il tape « » lui-même, il
   * referme le champ et écrit la suite comme si elle venait de la plateforme. Un champ ne peut pas
   * être délimité par un caractère que son contenu a le droit de porter.
   */
  private static final Pattern DELIMITEURS = Pattern.compile("[\u00AB\u00BB*_~`]");

  /** Unicode, et non le {@code \\s} ASCII : une espace insécable est une espace. */
  private static final Pattern BLANCS =
      Pattern.compile("[\\s\\p{Z}]+", Pattern.UNICODE_CHARACTER_CLASS);

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
    String plat = INVISIBLES.matcher(valeur).replaceAll(" ");
    plat = DELIMITEURS.matcher(plat).replaceAll(" ");
    plat = BLANCS.matcher(plat).replaceAll(" ").trim();
    if (plat.isEmpty()) {
      return "—";
    }
    // Tronquer au point de code et non au char : couper une paire de substitution en son milieu
    // produit un caractère illisible, et un nom qui finit par « ? » n'inspire pas confiance.
    int[] points = plat.codePoints().toArray();
    return points.length <= max ? plat : new String(points, 0, max) + "…";
  }
}
