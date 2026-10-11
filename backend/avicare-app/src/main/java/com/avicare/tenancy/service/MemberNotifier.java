package com.avicare.tenancy.service;

import com.avicare.common.security.principal.FarmRole;
import com.avicare.identity.api.dto.UserInfo;
import com.avicare.notification.api.WhatsAppOutboxFacade;
import com.avicare.tenancy.repository.FarmRepository;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

/**
 * Prévient la personne qu'on vient d'ajouter à une ferme.
 *
 * <p>Jusqu'ici, personne ne le lui disait. Elle découvrait la ferme dans son sélecteur sans savoir
 * qui l'avait ajoutée ni avec quels droits — et pour un compte tout neuf, le mot de passe
 * provisoire se transmettait de vive voix, donc souvent pas du tout. Le canal existe déjà
 * (l'exploitation est sur WhatsApp), il n'y avait qu'à s'en servir.
 *
 * <p><b>La ferme est nommée en premier</b>, comme pour {@code SupplierNotifier} : un message qui ne
 * dit pas de qui il vient est un numéro inconnu qui réclame quelque chose. Sans nom de ferme, on
 * n'envoie rien plutôt que d'envoyer ça.
 *
 * <p><b>Aucun mot de passe ne transite.</b> Un code de réinitialisation expire en quinze minutes ;
 * un mot de passe provisoire, non — il resterait lisible dans la conversation pour toujours. Le
 * message dit qu'un accès existe, la personne qui l'a créé transmet le reste.
 *
 * <p>Best-effort de bout en bout : {@code enqueue} ne lève jamais, et la lecture du nom de ferme
 * est contenue ici. Prévenir quelqu'un ne doit pas pouvoir annuler son rattachement.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class MemberNotifier {

  private final WhatsAppOutboxFacade whatsApp;
  private final FarmRepository farmRepository;

  /** Les libellés que les deux applications affichent déjà (web `FARM_ROLE_LABELS`). */
  private static final Map<FarmRole, String> ROLE_LABELS =
      Map.of(
          FarmRole.OWNER, "propriétaire",
          FarmRole.MANAGER, "gestionnaire",
          FarmRole.FARMER, "éleveur",
          FarmRole.VETERINARIAN, "vétérinaire",
          FarmRole.BUYER, "acheteur");

  /**
   * @param accountCreated {@code true} si le compte vient d'être créé, {@code false} si un compte
   *     existant a simplement été rattaché — les deux situations n'appellent pas la même phrase, et
   *     confondre les deux est précisément ce qui inquiète un propriétaire déjà inscrit ailleurs.
   */
  public void memberAdded(Long farmId, UserInfo user, FarmRole role, boolean accountCreated) {
    if (user == null || user.phone() == null || user.phone().isBlank()) {
      return;
    }
    String farmName = farmName(farmId);
    if (farmName == null) {
      return;
    }
    String roleLabel = ROLE_LABELS.getOrDefault(role, role.name().toLowerCase());

    String message =
        accountCreated
            ? farmName
                + " vous a créé un accès Jawdi comme "
                + roleLabel
                + ". Votre mot de passe provisoire vous sera communiqué par la personne qui vous a"
                + " ajouté ; vous pourrez le changer dans Réglages > Profil."
            : farmName
                + " vous a ajouté comme "
                + roleLabel
                + " sur Jawdi. Vous y accédez avec votre mot de passe habituel : la ferme"
                + " apparaîtra dans votre sélecteur de fermes d'ici quinze minutes, ou dès votre"
                + " prochaine connexion.";

    whatsApp.enqueue(user.phone(), message);
  }

  /**
   * {@code null} si la ferme est introuvable. N'arrive pas aujourd'hui — on est appelé après
   * l'écriture, sur une ferme qui existe — mais le message ne doit pas dépendre de ça restant vrai.
   */
  private String farmName(Long farmId) {
    return farmRepository
        .findById(farmId)
        .map(f -> f.getName())
        .orElseGet(
            () -> {
              log.warn("Cannot notify new member: farm {} not found", farmId);
              return null;
            });
  }
}
