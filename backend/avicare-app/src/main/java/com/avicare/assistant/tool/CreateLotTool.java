package com.avicare.assistant.tool;

import static com.avicare.assistant.tool.ToolArgs.asIntOrNull;
import static com.avicare.assistant.tool.ToolArgs.asString;

import com.avicare.assistant.dto.InterpretResponse;
import com.avicare.livestock.api.LivestockFacade;
import com.avicare.livestock.api.dto.PoultryBreedLite;
import java.text.Normalizer;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.stereotype.Component;

/**
 * Create a new broiler lot (a {@code PoultryBatch}). The dry-run resolves the breed spoken by name
 * against the farm's poultry catalogue and refuses up front when the breed is unknown or the head
 * count is missing/invalid; the actual write happens on confirm ({@code CreateLotExecutor}). Only
 * broiler lots — a layer flock is created differently and stays on the web/mobile form.
 */
@Component
public class CreateLotTool implements AssistantTool {

  private final LivestockFacade livestock;

  public CreateLotTool(LivestockFacade livestock) {
    this.livestock = livestock;
  }

  @Override
  public ToolSpec spec() {
    return new ToolSpec(
        "CREATE_LOT",
        "Créer un nouveau lot de poulets de chair : sa race et son effectif de départ.",
        List.of(
            ToolParam.required(
                "breed", ToolParam.Type.STRING, "Race / souche du lot (ex. Cobb 500, Ross 308)"),
            ToolParam.required(
                "count", ToolParam.Type.INTEGER, "Effectif de départ (nombre de poussins)"),
            ToolParam.optional("name", ToolParam.Type.STRING, "Nom du lot, si donné")));
  }

  @Override
  public String requiredPermission() {
    return "poultry:write";
  }

  @Override
  public InterpretResponse dryRun(Long farmId, Map<String, Object> args, Long contextUnitId) {
    Integer count = asIntOrNull(args.get("count"));
    if (count == null || count < 1) {
      return InterpretResponse.clarification("Combien de poussins dans ce nouveau lot ?");
    }
    String breedSpoken = asString(args.get("breed"));
    if (breedSpoken == null) {
      return InterpretResponse.clarification("Pour quelle race voulez-vous créer ce lot ?");
    }
    List<PoultryBreedLite> breeds = livestock.listPoultryBreeds(farmId);
    if (breeds.isEmpty()) {
      return InterpretResponse.clarification(
          "Aucune race de volaille dans votre catalogue. Ajoutez-en d'abord dans les réglages.");
    }
    PoultryBreedLite breed = match(breeds, breedSpoken);
    if (breed == null) {
      String available =
          breeds.stream().map(PoultryBreedLite::name).limit(6).collect(Collectors.joining(", "));
      return InterpretResponse.clarification(
          "Je ne trouve pas la race « "
              + breedSpoken
              + " ». Races disponibles : "
              + available
              + ".");
    }
    String name = asString(args.get("name"));

    Map<String, Object> fields = new LinkedHashMap<>();
    fields.put("breedId", breed.id());
    fields.put("breedName", breed.name());
    fields.put("initialCount", count);
    if (name != null) {
      fields.put("name", name);
    }

    String label = name != null ? name : breed.name();
    return InterpretResponse.draft(
        "CREATE_LOT",
        null,
        fields,
        "Nouveau lot : " + label + " — " + count + " sujets (" + breed.name() + ").");
  }

  /** Resolve a spoken breed to a catalogue entry by code or name, accent/case-insensitive. */
  private static PoultryBreedLite match(List<PoultryBreedLite> breeds, String spoken) {
    String n = normalise(spoken);
    if (n.isEmpty()) {
      return null;
    }
    return breeds.stream()
        .filter(b -> normalise(b.code()).equals(n) || normalise(b.name()).equals(n))
        .findFirst()
        .orElseGet(
            () ->
                breeds.stream()
                    .filter(b -> normalise(b.name()).contains(n) || n.contains(normalise(b.name())))
                    .findFirst()
                    .orElse(null));
  }

  private static String normalise(String s) {
    String stripped =
        Normalizer.normalize(s == null ? "" : s, Normalizer.Form.NFD).replaceAll("\\p{M}+", "");
    return stripped.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]+", "");
  }
}
