package com.avicare.assistant.tool;

import static com.avicare.assistant.tool.ToolArgs.asString;

import com.avicare.assistant.dto.InterpretResponse;
import com.avicare.livestock.api.dto.ProductionUnitInfo;
import java.text.Normalizer;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import org.springframework.stereotype.Component;

/**
 * Record a health observation on a lot (a symptom the worker noticed). The dry-run resolves the
 * lot, maps a spoken severity to the domain scale and dates it today; the write is the existing
 * observation endpoint. This is a signal, not a diagnosis — the worker describes, the system
 * stores.
 */
@Component
public class ObservationTool implements AssistantTool {

  private static final int TITLE_MAX = 200;

  private final LivestockUnits units;

  public ObservationTool(LivestockUnits units) {
    this.units = units;
  }

  @Override
  public ToolSpec spec() {
    return new ToolSpec(
        "HEALTH_OBSERVATION",
        "Signaler une observation sanitaire sur un lot : un symptôme ou comportement constaté.",
        List.of(
            ToolParam.required(
                "observation",
                ToolParam.Type.STRING,
                "Ce qui est constaté (ex. « les poules toussent »)"),
            ToolParam.optional(
                "severity",
                ToolParam.Type.STRING,
                "Gravité : « normale », « inquiétante » ou « critique », si dit"),
            ToolParam.optional(
                "suspectedDisease", ToolParam.Type.STRING, "Maladie suspectée, si dit")));
  }

  @Override
  public String requiredPermission() {
    return "health:write";
  }

  @Override
  public InterpretResponse dryRun(Long farmId, Map<String, Object> args, Long contextUnitId) {
    String observation = asString(args.get("observation"));
    if (observation == null) {
      return InterpretResponse.clarification("Que voulez-vous signaler ?");
    }
    Optional<ProductionUnitInfo> unit = units.resolve(farmId, contextUnitId);
    if (unit.isEmpty()) {
      return InterpretResponse.clarification(
          units.hasMultipleActive(farmId) ? "Sur quel lot ?" : "Aucun lot actif trouvé.");
    }
    ProductionUnitInfo u = unit.get();

    String title =
        observation.length() > TITLE_MAX ? observation.substring(0, TITLE_MAX) : observation;
    String severity = mapSeverity(asString(args.get("severity")));
    String suspectedDisease = asString(args.get("suspectedDisease"));

    Map<String, Object> fields = new LinkedHashMap<>();
    fields.put("unitId", u.id());
    fields.put("unitName", u.name());
    fields.put("observationDate", LocalDate.now().toString());
    fields.put("title", title);
    fields.put("description", observation);
    if (severity != null) {
      fields.put("severity", severity);
    }
    if (suspectedDisease != null) {
      fields.put("suspectedDisease", suspectedDisease);
    }

    return InterpretResponse.draft(
        "HEALTH_OBSERVATION",
        u.id(),
        fields,
        "Observation sur le lot "
            + u.name()
            + " : "
            + title
            + (severity != null ? " (" + severityLabel(severity) + ")" : "")
            + ".");
  }

  /** Map a spoken severity to the domain scale (NORMAL/WARNING/CRITICAL); null when unspecified. */
  private static String mapSeverity(String spoken) {
    if (spoken == null) {
      return null;
    }
    String n = normalise(spoken);
    if (n.contains("critiqu")
        || n.contains("grave")
        || n.contains("urgent")
        || n.contains("mort")) {
      return "CRITICAL";
    }
    if (n.contains("inquiet")
        || n.contains("modere")
        || n.contains("attention")
        || n.contains("warning")) {
      return "WARNING";
    }
    if (n.contains("normal") || n.contains("leger") || n.contains("benin")) {
      return "NORMAL";
    }
    return null;
  }

  private static String severityLabel(String severity) {
    return switch (severity) {
      case "CRITICAL" -> "critique";
      case "WARNING" -> "à surveiller";
      default -> "normale";
    };
  }

  private static String normalise(String s) {
    String stripped = Normalizer.normalize(s, Normalizer.Form.NFD).replaceAll("\\p{M}+", "");
    return stripped.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]+", "");
  }
}
