package com.avicare.livestock.inventory;

import com.avicare.livestock.domain.Supplier;
import com.avicare.notification.api.WhatsAppOutboxFacade;
import com.avicare.tenancy.api.TenancyFacade;
import java.text.NumberFormat;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.Locale;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * Écrit au fournisseur — quelqu'un qui n'a pas de compte sur la plateforme et n'a rien accepté
 * d'elle. Trois règles tiennent ces messages :
 *
 * <p>La ferme est nommée en premier : sans elle, un numéro inconnu envoie des chiffres.
 *
 * <p>Le solde est présenté comme la position de la ferme — « selon mes comptes » — et non comme une
 * vérité opposable. Un compte-courant se réconcilie ; l'énoncer comme un fait ferait d'un outil de
 * confiance une source de litige.
 *
 * <p>Aucune promesse de désabonnement : l'instance Konekt est un téléphone connecté dont personne
 * ne lit les réponses. Le message nomme la ferme, et c'est à elle que le fournisseur s'adresse.
 */
@Component
@RequiredArgsConstructor
public class SupplierNotifier {

  private final WhatsAppOutboxFacade whatsApp;
  private final TenancyFacade tenancyFacade;

  private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("dd/MM/yyyy");

  public void paymentRecorded(
      Long farmId, Supplier supplier, long amountXof, long balanceAfterXof, LocalDate date) {
    if (!shouldNotify(supplier)) return;
    String farmName = farmName(farmId);

    String remaining =
        balanceAfterXof > 0
            ? "Reste dû : " + money(balanceAfterXof) + " FCFA selon mes comptes."
            : "Mon compte est soldé selon mes comptes.";

    whatsApp.enqueue(
        supplier.getPhone(),
        farmName
            + " — paiement enregistré le "
            + DATE.format(date)
            + " : "
            + money(amountXof)
            + " FCFA. "
            + remaining);
  }

  public void purchaseOrderSent(Long farmId, Supplier supplier, String orderNumber, long totalXof) {
    if (!shouldNotify(supplier)) return;
    String farmName = farmName(farmId);

    whatsApp.enqueue(
        supplier.getPhone(),
        farmName
            + " — nouvelle commande "
            + orderNumber
            + " d'un montant de "
            + money(totalXof)
            + " FCFA. Merci de confirmer la livraison.");
  }

  /** Le nom que le fournisseur reconnaîtra. Résolu ici pour qu'aucun appelant n'ait à le porter. */
  private String farmName(Long farmId) {
    return tenancyFacade.findById(farmId).name();
  }

  /** L'interrupteur, et un numéro pour y aller. Un interrupteur sans numéro n'envoie rien. */
  private static boolean shouldNotify(Supplier supplier) {
    return supplier != null
        && supplier.isNotifyWhatsapp()
        && supplier.getPhone() != null
        && !supplier.getPhone().isBlank();
  }

  private static String money(long xof) {
    return NumberFormat.getNumberInstance(Locale.FRANCE).format(xof);
  }
}
