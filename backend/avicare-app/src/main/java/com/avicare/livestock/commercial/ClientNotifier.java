package com.avicare.livestock.commercial;

import com.avicare.common.api.exception.NotFoundException;
import com.avicare.livestock.domain.Client;
import com.avicare.notification.api.WhatsAppOutboxFacade;
import com.avicare.tenancy.api.TenancyFacade;
import java.text.NumberFormat;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.Locale;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

/**
 * Écrit au client — quelqu'un qui n'a pas de compte sur la plateforme et n'a rien accepté d'elle.
 * Pendant exact de {@link com.avicare.livestock.inventory.SupplierNotifier}, et pour les mêmes
 * raisons.
 *
 * <p>La ferme est nommée en premier : sans elle, un numéro inconnu réclame de l'argent, ce qui est
 * la forme même de l'arnaque. Un message dont on ne sait pas d'où il vient n'est pas seulement
 * inutile, il est nuisible.
 *
 * <p>Les montants sont présentés comme la position de la ferme — « selon nos comptes » — jamais
 * comme une vérité opposable. Une facture se conteste ; l'énoncer comme un fait ferait d'un rappel
 * courtois une mise en demeure.
 *
 * <p>Aucune promesse de désabonnement : l'instance Konekt est un téléphone connecté dont personne
 * ne lit les réponses. Le message nomme la ferme, et c'est à elle que le client s'adresse.
 *
 * <p>Le notifieur ne doit jamais pouvoir casser l'écriture métier qu'il rapporte : une facture
 * émise reste émise même si l'avis ne part pas. {@code enqueue} ne lève jamais, mais la résolution
 * du nom de ferme le peut ; elle est donc contenue ici.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class ClientNotifier {

  private final WhatsAppOutboxFacade whatsApp;
  private final TenancyFacade tenancyFacade;

  private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("dd/MM/yyyy");

  /**
   * Facture émise — le seul message où le client a quelque chose à faire.
   *
   * <p>L'échéance n'est mentionnée que si elle existe : inventer « à régler rapidement » sur une
   * facture sans date mettrait une pression que la ferme n'a pas décidée.
   */
  public void invoiceIssued(
      Long farmId, Client client, String invoiceNumber, long totalXof, LocalDate dueDate) {
    if (!shouldNotify(client)) return;
    String farmName = farmName(farmId);
    if (farmName == null) return;

    String due = dueDate == null ? "" : " À régler avant le " + DATE.format(dueDate) + ".";

    whatsApp.enqueue(
        client.getPhone(),
        farmName
            + " — facture "
            + invoiceNumber
            + " d'un montant de "
            + money(totalXof)
            + " FCFA."
            + due);
  }

  /**
   * Paiement reçu — l'accusé de réception qu'on attend de quelqu'un à qui on vient de donner de
   * l'argent. Le reste dû suit, parce que c'est la question suivante.
   */
  public void paymentReceived(
      Long farmId, Client client, long amountXof, long outstandingXof, LocalDate date) {
    if (!shouldNotify(client)) return;
    String farmName = farmName(farmId);
    if (farmName == null) return;

    String remaining =
        outstandingXof > 0
            ? " Reste dû : " + money(outstandingXof) + " FCFA selon nos comptes."
            : " Votre compte est soldé, merci.";

    whatsApp.enqueue(
        client.getPhone(),
        farmName
            + " — paiement reçu le "
            + DATE.format(date)
            + " : "
            + money(amountXof)
            + " FCFA."
            + remaining);
  }

  /**
   * Le nom que le client reconnaîtra. {@code null} si la ferme est introuvable — les appelants
   * renoncent alors à l'envoi, sans jamais propager : on n'envoie rien plutôt qu'un numéro inconnu.
   */
  private String farmName(Long farmId) {
    try {
      return tenancyFacade.findById(farmId).name();
    } catch (NotFoundException e) {
      log.warn("Cannot notify client: farm {} not found", farmId);
      return null;
    }
  }

  /** L'interrupteur, et un numéro pour y aller. Un interrupteur sans numéro n'envoie rien. */
  private static boolean shouldNotify(Client client) {
    return client != null
        && client.isNotifyWhatsapp()
        && client.getPhone() != null
        && !client.getPhone().isBlank();
  }

  private static String money(long xof) {
    return NumberFormat.getNumberInstance(Locale.FRANCE).format(xof);
  }
}
