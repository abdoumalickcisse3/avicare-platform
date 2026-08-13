package com.avicare.assistant.tool;

import static com.avicare.assistant.tool.ToolArgs.asInt;
import static com.avicare.assistant.tool.ToolArgs.asString;

import com.avicare.assistant.dto.InterpretResponse;
import com.avicare.livestock.api.LivestockFacade;
import com.avicare.livestock.api.dto.ProductionUnitInfo;
import com.avicare.parameters.api.ParametersFacade;
import com.avicare.parameters.api.dto.CatalogEntryInfo;
import java.text.Normalizer;
import java.time.LocalDate;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;
import org.springframework.stereotype.Component;

/**
 * Record an egg collection on a layer flock: the good-egg total, the broken count, and the
 * time-slot. The dry-run resolves the layer lot (the one the assistant was opened from, else the
 * farm's single active layer flock) and the spoken time-slot against the farm's {@code
 * egg_timeslots} catalog, so the confirmation card carries the true keys; the write is the existing
 * egg-collection endpoint (upsert per unit/date/slot).
 *
 * <p>The time-slot catalog is read straight from {@link ParametersFacade} (not via {@link
 * LivestockFacade}) to keep the livestock facade's dependency graph tight — narrow
 * {@code @DataJpaTest} slices import that facade and must stay satisfiable.
 */
@Component
public class EggCollectionTool implements AssistantTool {

  private static final String CATEGORY_TIMESLOTS = "egg_timeslots";

  private final LivestockFacade livestock;
  private final ParametersFacade parameters;

  public EggCollectionTool(LivestockFacade livestock, ParametersFacade parameters) {
    this.livestock = livestock;
    this.parameters = parameters;
  }

  @Override
  public ToolSpec spec() {
    return new ToolSpec(
        "EGG_COLLECTION",
        "Enregistrer un ramassage d'œufs sur un lot de pondeuses : nombre d'œufs bons, œufs cassés,"
            + " créneau de ramassage.",
        List.of(
            ToolParam.required("totalEggs", ToolParam.Type.INTEGER, "Nombre d'œufs bons ramassés"),
            ToolParam.optional(
                "brokenEggs", ToolParam.Type.INTEGER, "Nombre d'œufs cassés, si dit"),
            ToolParam.optional(
                "timeslot",
                ToolParam.Type.STRING,
                "Créneau de ramassage : « matin », « midi » ou « soir », si dit")));
  }

  @Override
  public String requiredPermission() {
    return "poultry:write";
  }

  @Override
  public InterpretResponse dryRun(Long farmId, Map<String, Object> args, Long contextUnitId) {
    int totalEggs = asInt(args.get("totalEggs"));
    int brokenEggs = Math.max(0, asInt(args.get("brokenEggs")));
    if (totalEggs < 1 && brokenEggs < 1) {
      return InterpretResponse.clarification("Combien d'œufs avez-vous ramassés ?");
    }

    List<ProductionUnitInfo> layers = livestock.activeLayerUnits(farmId);
    Optional<ProductionUnitInfo> unit = resolveLayer(layers, contextUnitId);
    if (unit.isEmpty()) {
      return InterpretResponse.clarification(
          layers.size() > 1
              ? "Sur quel lot de pondeuses ?"
              : "Aucun lot de pondeuses actif trouvé.");
    }
    ProductionUnitInfo u = unit.get();

    List<CatalogEntryInfo> slots = timeslots(farmId);
    if (slots.isEmpty()) {
      return InterpretResponse.clarification(
          "Aucun créneau de ramassage n'est configuré pour cette ferme.");
    }
    Optional<CatalogEntryInfo> slot = resolveTimeslot(slots, asString(args.get("timeslot")));
    if (slot.isEmpty()) {
      String labels =
          slots.stream().map(EggCollectionTool::label).collect(Collectors.joining(", "));
      return InterpretResponse.clarification("Quel créneau de ramassage ? " + labels + ".");
    }
    CatalogEntryInfo s = slot.get();

    Map<String, Object> fields = new LinkedHashMap<>();
    fields.put("unitId", u.id());
    fields.put("unitName", u.name());
    fields.put("collectionDate", LocalDate.now().toString());
    fields.put("timeslotKey", s.key());
    fields.put("timeslotLabel", label(s));
    fields.put("totalEggs", totalEggs);
    fields.put("brokenEggs", brokenEggs);

    return InterpretResponse.draft(
        "EGG_COLLECTION",
        u.id(),
        fields,
        "Ramassage de "
            + totalEggs
            + " œufs"
            + (brokenEggs > 0 ? " (dont " + brokenEggs + " cassés)" : "")
            + " sur le lot "
            + u.name()
            + " — créneau "
            + label(s)
            + ".");
  }

  /** The farm's egg-collection time-slots, ordered by the catalog's {@code order} field. */
  private List<CatalogEntryInfo> timeslots(Long farmId) {
    return parameters.listForFarm(farmId, CATEGORY_TIMESLOTS).stream()
        .sorted(Comparator.comparingInt(EggCollectionTool::order))
        .toList();
  }

  /**
   * The target layer lot: the opened-lot context when it is a layer flock, else the farm's single
   * active layer flock; empty when ambiguous/none.
   */
  private static Optional<ProductionUnitInfo> resolveLayer(
      List<ProductionUnitInfo> layers, Long contextUnitId) {
    if (contextUnitId != null) {
      return layers.stream().filter(u -> u.id().equals(contextUnitId)).findFirst();
    }
    return layers.size() == 1 ? Optional.of(layers.get(0)) : Optional.empty();
  }

  /**
   * Match the spoken slot against a catalog key or label (accent/case-insensitive, contains). When
   * nothing is said, default to the single configured slot; otherwise ask.
   */
  private static Optional<CatalogEntryInfo> resolveTimeslot(
      List<CatalogEntryInfo> slots, String spoken) {
    if (spoken == null) {
      return slots.size() == 1 ? Optional.of(slots.get(0)) : Optional.empty();
    }
    String needle = normalise(spoken);
    if (needle.isEmpty()) {
      return slots.size() == 1 ? Optional.of(slots.get(0)) : Optional.empty();
    }
    Optional<CatalogEntryInfo> exact =
        slots.stream()
            .filter(s -> normalise(s.key()).equals(needle) || normalise(label(s)).equals(needle))
            .findFirst();
    if (exact.isPresent()) {
      return exact;
    }
    return slots.stream()
        .filter(
            s ->
                normalise(s.key()).contains(needle)
                    || normalise(label(s)).contains(needle)
                    || needle.contains(normalise(label(s))))
        .findFirst();
  }

  private static int order(CatalogEntryInfo entry) {
    Object order = entry.value().get("order");
    return order instanceof Number n ? n.intValue() : Integer.MAX_VALUE;
  }

  private static String label(CatalogEntryInfo entry) {
    Object label = entry.value().get("label");
    return label != null ? label.toString() : entry.key();
  }

  private static String normalise(String s) {
    String stripped = Normalizer.normalize(s, Normalizer.Form.NFD).replaceAll("\\p{M}+", "");
    return stripped.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]+", "");
  }
}
