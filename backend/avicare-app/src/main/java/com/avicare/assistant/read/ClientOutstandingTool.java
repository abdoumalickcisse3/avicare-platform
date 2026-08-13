package com.avicare.assistant.read;

import com.avicare.assistant.tool.ToolParam;
import com.avicare.assistant.tool.ToolSpec;
import com.avicare.livestock.commercial.ClientLite;
import com.avicare.livestock.commercial.CommercialFacade;
import com.avicare.livestock.commercial.dto.CommercialStats;
import java.text.Normalizer;
import java.time.LocalDate;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;
import org.springframework.stereotype.Component;

/**
 * Consult client receivables (encours) — a single client's balance when named, else the farm-wide
 * total plus the top debtors. Read-only: hits {@link CommercialFacade}. A positive balance is owed
 * to the farm; a negative one is an advance the client paid.
 */
@Component
public class ClientOutstandingTool implements ReadTool {

  private final CommercialFacade commercial;

  public ClientOutstandingTool(CommercialFacade commercial) {
    this.commercial = commercial;
  }

  @Override
  public ToolSpec spec() {
    return new ToolSpec(
        "CLIENT_OUTSTANDING",
        "Consulter les encours clients (ce qu'un client doit) : un client précis si nommé, sinon"
            + " l'encours total et les principaux débiteurs.",
        List.of(
            ToolParam.optional(
                "clientName", ToolParam.Type.STRING, "Nom du client, si un client précis")));
  }

  @Override
  public String requiredPermission() {
    return "commercial:read";
  }

  @Override
  public String read(Long farmId, Map<String, Object> args, Long contextUnitId) {
    Object clientName = args.get("clientName");
    if (clientName != null && !clientName.toString().isBlank()) {
      return oneClient(farmId, clientName.toString());
    }
    return farmWide(farmId);
  }

  private String oneClient(Long farmId, String spoken) {
    List<ClientLite> clients = commercial.listClients(farmId);
    Optional<ClientLite> match = resolve(clients, spoken);
    if (match.isEmpty()) {
      return "Client introuvable : " + spoken + ".";
    }
    ClientLite c = match.get();
    long balance = c.currentBalanceXof();
    if (balance > 0) {
      return c.displayName() + " doit " + balance + " F CFA.";
    }
    if (balance < 0) {
      return c.displayName() + " a une avance de " + (-balance) + " F CFA.";
    }
    return c.displayName() + " est à jour (aucun encours).";
  }

  private String farmWide(Long farmId) {
    LocalDate to = LocalDate.now();
    CommercialStats stats = commercial.commercialStats(farmId, to.minusDays(364), to);
    String debtors =
        stats.topDebtors().stream()
            .limit(3)
            .map(d -> d.name() + " (" + d.valueXof() + " F CFA)")
            .collect(Collectors.joining(", "));
    String base = "Encours total : " + stats.outstandingXof() + " F CFA.";
    return debtors.isEmpty() ? base : base + " Principaux débiteurs : " + debtors + ".";
  }

  private static Optional<ClientLite> resolve(List<ClientLite> clients, String spoken) {
    String needle = normalise(spoken);
    if (needle.isEmpty()) {
      return Optional.empty();
    }
    Optional<ClientLite> exact =
        clients.stream().filter(c -> normalise(c.displayName()).equals(needle)).findFirst();
    return exact.isPresent()
        ? exact
        : clients.stream().filter(c -> normalise(c.displayName()).contains(needle)).findFirst();
  }

  private static String normalise(String s) {
    String stripped = Normalizer.normalize(s, Normalizer.Form.NFD).replaceAll("\\p{M}+", "");
    return stripped.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]+", "");
  }
}
