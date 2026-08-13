package com.avicare.assistant.tool;

import static com.avicare.assistant.tool.ToolArgs.asIntOrNull;
import static com.avicare.assistant.tool.ToolArgs.asString;

import com.avicare.assistant.dto.InterpretResponse;
import com.avicare.livestock.api.dto.ProductionUnitInfo;
import com.avicare.parameters.api.ParametersFacade;
import com.avicare.parameters.api.dto.CatalogEntryInfo;
import java.text.Normalizer;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;
import org.springframework.stereotype.Component;

/**
 * Record a vaccination on a lot. The dry-run resolves the lot and the spoken vaccine against the
 * farm's {@code vaccines} catalog, defaults the count to the lot's headcount, and dates it today,
 * so the confirmation card carries the real key; the write is the existing vaccination endpoint.
 */
@Component
public class VaccinationTool implements AssistantTool {

  private static final String CATEGORY_VACCINES = "vaccines";

  private final LivestockUnits units;
  private final ParametersFacade parameters;

  public VaccinationTool(LivestockUnits units, ParametersFacade parameters) {
    this.units = units;
    this.parameters = parameters;
  }

  @Override
  public ToolSpec spec() {
    return new ToolSpec(
        "VACCINATION",
        "Enregistrer une vaccination sur un lot : le vaccin administré, et le nombre de sujets.",
        List.of(
            ToolParam.required(
                "vaccine",
                ToolParam.Type.STRING,
                "Nom du vaccin ou maladie visée (ex. « Newcastle »)"),
            ToolParam.optional(
                "subjectsCount",
                ToolParam.Type.INTEGER,
                "Nombre de sujets vaccinés, sinon tout le lot")));
  }

  @Override
  public String requiredPermission() {
    return "health:write";
  }

  @Override
  public InterpretResponse dryRun(Long farmId, Map<String, Object> args, Long contextUnitId) {
    String vaccine = asString(args.get("vaccine"));
    if (vaccine == null) {
      return InterpretResponse.clarification("Quel vaccin avez-vous administré ?");
    }
    Optional<ProductionUnitInfo> unit = units.resolve(farmId, contextUnitId);
    if (unit.isEmpty()) {
      return InterpretResponse.clarification(
          units.hasMultipleActive(farmId) ? "Sur quel lot ?" : "Aucun lot actif trouvé.");
    }
    ProductionUnitInfo u = unit.get();

    List<CatalogEntryInfo> vaccines = parameters.listForFarm(farmId, CATEGORY_VACCINES);
    if (vaccines.isEmpty()) {
      return InterpretResponse.clarification("Aucun vaccin au catalogue de cette ferme.");
    }
    Optional<CatalogEntryInfo> match = resolve(vaccines, vaccine);
    if (match.isEmpty()) {
      String known =
          vaccines.stream().map(VaccinationTool::label).limit(4).collect(Collectors.joining(", "));
      return InterpretResponse.clarification("Quel vaccin ? Par exemple : " + known + ".");
    }
    CatalogEntryInfo v = match.get();
    int subjectsCount = firstPositive(asIntOrNull(args.get("subjectsCount")), u.currentCount());

    Map<String, Object> fields = new LinkedHashMap<>();
    fields.put("unitId", u.id());
    fields.put("unitName", u.name());
    fields.put("vaccineKey", v.key());
    fields.put("vaccineLabel", label(v));
    fields.put("administeredDate", LocalDate.now().toString());
    fields.put("subjectsCount", subjectsCount);

    return InterpretResponse.draft(
        "VACCINATION",
        u.id(),
        fields,
        "Vaccination du lot "
            + u.name()
            + " avec "
            + label(v)
            + " — "
            + subjectsCount
            + " sujet(s), aujourd'hui.");
  }

  private static int firstPositive(Integer spoken, int fallback) {
    return spoken != null && spoken > 0 ? spoken : fallback;
  }

  private static Optional<CatalogEntryInfo> resolve(
      List<CatalogEntryInfo> vaccines, String spoken) {
    String needle = normalise(spoken);
    if (needle.isEmpty()) {
      return Optional.empty();
    }
    Optional<CatalogEntryInfo> exact =
        vaccines.stream()
            .filter(
                v ->
                    normalise(v.key()).equals(needle)
                        || normalise(label(v)).equals(needle)
                        || normalise(disease(v)).equals(needle))
            .findFirst();
    if (exact.isPresent()) {
      return exact;
    }
    return vaccines.stream()
        .filter(
            v ->
                normalise(label(v)).contains(needle)
                    || normalise(disease(v)).contains(needle)
                    || normalise(v.key()).contains(needle)
                    || contained(needle, label(v))
                    || contained(needle, disease(v)))
        .findFirst();
  }

  /** Whether the vaccine's {@code term} (non-empty) appears inside the spoken {@code needle}. */
  private static boolean contained(String needle, String term) {
    String t = normalise(term);
    return !t.isEmpty() && needle.contains(t);
  }

  private static String label(CatalogEntryInfo entry) {
    Object label = entry.value().get("label");
    return label != null ? label.toString() : entry.key();
  }

  private static String disease(CatalogEntryInfo entry) {
    Object disease = entry.value().get("disease");
    return disease != null ? disease.toString() : "";
  }

  private static String normalise(String s) {
    String stripped = Normalizer.normalize(s, Normalizer.Form.NFD).replaceAll("\\p{M}+", "");
    return stripped.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]+", "");
  }
}
