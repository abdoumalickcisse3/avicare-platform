package com.avicare.assistant.tool;

import static com.avicare.assistant.tool.ToolArgs.asString;

import com.avicare.assistant.dto.InterpretResponse;
import com.avicare.livestock.commercial.ClientLite;
import com.avicare.livestock.commercial.CommercialFacade;
import java.text.Normalizer;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.springframework.stereotype.Component;

/**
 * Create a commercial client. The dry-run structures the name and type and refuses up front if a
 * client with the same name already exists (so the worker doesn't duplicate); the write is the
 * existing client endpoint. A light entity — most fields (phone, credit limit…) are added later on
 * the web/mobile form.
 */
@Component
public class CreateClientTool implements AssistantTool {

  private final CommercialFacade commercial;

  public CreateClientTool(CommercialFacade commercial) {
    this.commercial = commercial;
  }

  @Override
  public ToolSpec spec() {
    return new ToolSpec(
        "CREATE_CLIENT",
        "Créer un nouveau client commercial : son nom et éventuellement son type.",
        List.of(
            ToolParam.required("name", ToolParam.Type.STRING, "Nom du client"),
            ToolParam.optional(
                "type",
                ToolParam.Type.STRING,
                "Type : « particulier », « entreprise » ou « grossiste », si dit")));
  }

  @Override
  public String requiredPermission() {
    return "commercial:write";
  }

  @Override
  public InterpretResponse dryRun(Long farmId, Map<String, Object> args, Long contextUnitId) {
    String name = asString(args.get("name"));
    if (name == null) {
      return InterpretResponse.clarification("Quel est le nom du client ?");
    }
    List<ClientLite> clients = commercial.listClients(farmId);
    String needle = normalise(name);
    boolean exists = clients.stream().anyMatch(c -> normalise(c.displayName()).equals(needle));
    if (exists) {
      return InterpretResponse.clarification("Le client « " + name + " » existe déjà.");
    }
    String clientType = mapType(asString(args.get("type")));

    Map<String, Object> fields = new LinkedHashMap<>();
    fields.put("displayName", name);
    fields.put("clientType", clientType);

    return InterpretResponse.draft(
        "CREATE_CLIENT",
        null,
        fields,
        "Nouveau client : " + name + " (" + typeLabel(clientType) + ").");
  }

  /** Map a spoken type to the domain enum name; defaults to INDIVIDUAL. */
  private static String mapType(String spoken) {
    if (spoken == null) {
      return "INDIVIDUAL";
    }
    String n = normalise(spoken);
    if (n.contains("grossiste") || n.contains("gros")) {
      return "WHOLESALER";
    }
    if (n.contains("entreprise") || n.contains("societe") || n.contains("business")) {
      return "BUSINESS";
    }
    return "INDIVIDUAL";
  }

  private static String typeLabel(String clientType) {
    return switch (clientType) {
      case "WHOLESALER" -> "grossiste";
      case "BUSINESS" -> "entreprise";
      default -> "particulier";
    };
  }

  private static String normalise(String s) {
    String stripped = Normalizer.normalize(s, Normalizer.Form.NFD).replaceAll("\\p{M}+", "");
    return stripped.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]+", "");
  }
}
