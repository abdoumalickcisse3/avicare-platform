package com.avicare.assistant.tool;

import static com.avicare.assistant.tool.ToolArgs.asInt;
import static com.avicare.assistant.tool.ToolArgs.asString;

import com.avicare.assistant.dto.InterpretResponse;
import com.avicare.livestock.commercial.ClientLite;
import com.avicare.livestock.commercial.CommercialFacade;
import com.avicare.livestock.commercial.OpenInvoiceInfo;
import java.text.Normalizer;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;
import org.springframework.stereotype.Component;

/**
 * Record an encaissement: a client paid, we credit their oldest open invoice first (the field
 * reality — the oldest debt is cleared first). The dry-run resolves the spoken client name, finds
 * their oldest still-payable invoice and caps the amount at what is due on it, so the confirmation
 * card shows the true receivable before → after and never over-pays. The write is the existing
 * payment endpoint (one payment against that invoice).
 */
@Component
public class RecordPaymentTool implements AssistantTool {

  private final CommercialFacade commercial;

  public RecordPaymentTool(CommercialFacade commercial) {
    this.commercial = commercial;
  }

  @Override
  public ToolSpec spec() {
    return new ToolSpec(
        "RECORD_PAYMENT",
        "Enregistrer un encaissement : un client a payé un montant (paiement reçu).",
        List.of(
            ToolParam.required("clientName", ToolParam.Type.STRING, "Nom du client qui a payé"),
            ToolParam.required("amountXof", ToolParam.Type.INTEGER, "Montant encaissé en F CFA"),
            ToolParam.optional(
                "method",
                ToolParam.Type.STRING,
                "Moyen de paiement : « espèces », « mobile money » ou « virement », si dit")));
  }

  @Override
  public String requiredPermission() {
    return "commercial:write";
  }

  @Override
  public InterpretResponse dryRun(Long farmId, Map<String, Object> args, Long contextUnitId) {
    int amount = asInt(args.get("amountXof"));
    if (amount < 1) {
      return InterpretResponse.clarification("Quel montant a été encaissé ?");
    }
    String clientName = asString(args.get("clientName"));
    if (clientName == null) {
      return InterpretResponse.clarification("De quel client vient ce paiement ?");
    }

    List<ClientLite> clients = commercial.listClients(farmId);
    Optional<ClientLite> match = resolveClient(clients, clientName);
    if (match.isEmpty()) {
      String known =
          clients.stream().map(ClientLite::displayName).limit(4).collect(Collectors.joining(", "));
      return InterpretResponse.clarification(
          known.isEmpty()
              ? "Aucun client enregistré pour cette ferme."
              : "Quel client ? Par exemple : " + known + ".");
    }
    ClientLite client = match.get();

    Optional<OpenInvoiceInfo> invoice =
        commercial.oldestOpenInvoiceForClient(farmId, client.clientId());
    if (invoice.isEmpty()) {
      return InterpretResponse.clarification(
          client.displayName() + " n'a aucune facture en attente de paiement.");
    }
    OpenInvoiceInfo inv = invoice.get();
    long outstanding = inv.outstandingXof();
    long applied = Math.min(amount, outstanding);
    boolean capped = amount > outstanding;

    Map<String, Object> fields = new LinkedHashMap<>();
    fields.put("clientId", client.clientId());
    fields.put("clientName", client.displayName());
    fields.put("invoiceId", inv.invoiceId());
    fields.put("invoiceNumber", inv.invoiceNumber());
    fields.put("amountXof", applied);
    fields.put("outstandingBefore", outstanding);
    fields.put("outstandingAfter", outstanding - applied);
    String method = resolveMethod(asString(args.get("method")));
    if (method != null) {
      fields.put("method", method);
    }

    return InterpretResponse.draft(
        "RECORD_PAYMENT",
        null,
        fields,
        "Encaissement de "
            + applied
            + " F CFA de "
            + client.displayName()
            + " sur la facture "
            + inv.invoiceNumber()
            + " — reste "
            + outstanding
            + " → "
            + (outstanding - applied)
            + (capped ? " (montant plafonné au dû de la facture)" : "")
            + ".");
  }

  /** Exact display-name match, else a spoken name contained in a client's display name. */
  private static Optional<ClientLite> resolveClient(List<ClientLite> clients, String spoken) {
    String needle = normalise(spoken);
    if (needle.isEmpty()) {
      return Optional.empty();
    }
    Optional<ClientLite> exact =
        clients.stream().filter(c -> normalise(c.displayName()).equals(needle)).findFirst();
    if (exact.isPresent()) {
      return exact;
    }
    return clients.stream().filter(c -> normalise(c.displayName()).contains(needle)).findFirst();
  }

  /** Map a spoken payment method to the domain enum name; null when unspecified/unrecognised. */
  private static String resolveMethod(String spoken) {
    if (spoken == null) {
      return null;
    }
    String n = normalise(spoken);
    if (n.contains("especes") || n.contains("cash") || n.contains("liquide")) {
      return "CASH";
    }
    if (n.contains("mobile") || n.contains("wave") || n.contains("orange") || n.contains("momo")) {
      return "MOBILE_MONEY";
    }
    if (n.contains("virement") || n.contains("banque") || n.contains("transfer")) {
      return "BANK_TRANSFER";
    }
    return null;
  }

  private static String normalise(String s) {
    String stripped = Normalizer.normalize(s, Normalizer.Form.NFD).replaceAll("\\p{M}+", "");
    return stripped.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]+", "");
  }
}
