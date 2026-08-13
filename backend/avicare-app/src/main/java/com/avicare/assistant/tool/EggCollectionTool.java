package com.avicare.assistant.tool;

import static com.avicare.assistant.tool.ToolArgs.asInt;
import static com.avicare.assistant.tool.ToolArgs.asString;

import com.avicare.assistant.dto.InterpretResponse;
import com.avicare.livestock.api.LivestockFacade;
import com.avicare.livestock.api.dto.ProductionUnitInfo;
import com.avicare.livestock.api.dto.TimeslotInfo;
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
 * Record an egg collection on a layer flock: the good-egg total, the broken count, and the
 * time-slot. The dry-run resolves the layer lot (the one the assistant was opened from, else the
 * farm's single active layer flock) and the spoken time-slot against the farm's {@code
 * egg_timeslots} catalog, so the confirmation card carries the true keys; the write is the existing
 * egg-collection endpoint (upsert per unit/date/slot).
 */
@Component
public class EggCollectionTool implements AssistantTool {

  private final LivestockFacade livestock;

  public EggCollectionTool(LivestockFacade livestock) {
    this.livestock = livestock;
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

    List<TimeslotInfo> slots = livestock.layerTimeslots(farmId);
    if (slots.isEmpty()) {
      return InterpretResponse.clarification(
          "Aucun créneau de ramassage n'est configuré pour cette ferme.");
    }
    Optional<TimeslotInfo> slot = resolveTimeslot(slots, asString(args.get("timeslot")));
    if (slot.isEmpty()) {
      String labels = slots.stream().map(TimeslotInfo::label).collect(Collectors.joining(", "));
      return InterpretResponse.clarification("Quel créneau de ramassage ? " + labels + ".");
    }
    TimeslotInfo s = slot.get();

    Map<String, Object> fields = new LinkedHashMap<>();
    fields.put("unitId", u.id());
    fields.put("unitName", u.name());
    fields.put("collectionDate", LocalDate.now().toString());
    fields.put("timeslotKey", s.key());
    fields.put("timeslotLabel", s.label());
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
            + s.label()
            + ".");
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
  private static Optional<TimeslotInfo> resolveTimeslot(List<TimeslotInfo> slots, String spoken) {
    if (spoken == null) {
      return slots.size() == 1 ? Optional.of(slots.get(0)) : Optional.empty();
    }
    String needle = normalise(spoken);
    if (needle.isEmpty()) {
      return slots.size() == 1 ? Optional.of(slots.get(0)) : Optional.empty();
    }
    Optional<TimeslotInfo> exact =
        slots.stream()
            .filter(s -> normalise(s.key()).equals(needle) || normalise(s.label()).equals(needle))
            .findFirst();
    if (exact.isPresent()) {
      return exact;
    }
    return slots.stream()
        .filter(
            s ->
                normalise(s.key()).contains(needle)
                    || normalise(s.label()).contains(needle)
                    || needle.contains(normalise(s.label())))
        .findFirst();
  }

  private static String normalise(String s) {
    String stripped = Normalizer.normalize(s, Normalizer.Form.NFD).replaceAll("\\p{M}+", "");
    return stripped.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]+", "");
  }
}
