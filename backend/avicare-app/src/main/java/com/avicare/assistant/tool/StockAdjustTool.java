package com.avicare.assistant.tool;

import static com.avicare.assistant.tool.ToolArgs.asInt;
import static com.avicare.assistant.tool.ToolArgs.asString;

import com.avicare.assistant.dto.InterpretResponse;
import com.avicare.livestock.api.InventoryFacade;
import com.avicare.livestock.api.dto.InventoryStockInfo;
import java.text.Normalizer;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;
import org.springframework.stereotype.Component;

/**
 * Adjust the stock of an inventory article (add on reception, remove on loss). The dry-run resolves
 * the spoken article against the farm's catalog and shows the real before → after; the write is the
 * existing stock-movement endpoint. A negative delta below zero is refused up front.
 */
@Component
public class StockAdjustTool implements AssistantTool {

  private final InventoryFacade inventory;

  public StockAdjustTool(InventoryFacade inventory) {
    this.inventory = inventory;
  }

  @Override
  public ToolSpec spec() {
    return new ToolSpec(
        "ADJUST_STOCK",
        "Ajuster le stock d'un article : ajouter (réception) ou retirer (perte, consommation).",
        List.of(
            ToolParam.required(
                "article", ToolParam.Type.STRING, "Nom ou clé de l'article (ex. « aliment »)"),
            ToolParam.required(
                "delta",
                ToolParam.Type.INTEGER,
                "Quantité : positive pour ajouter, négative pour retirer")));
  }

  @Override
  public String requiredPermission() {
    return "inventory:write";
  }

  @Override
  public InterpretResponse dryRun(Long farmId, Map<String, Object> args, Long contextUnitId) {
    String article = asString(args.get("article"));
    int delta = asInt(args.get("delta"));
    if (article == null) {
      return InterpretResponse.clarification("Quel article ?");
    }
    if (delta == 0) {
      return InterpretResponse.clarification("Combien ajouter ou retirer ?");
    }
    List<InventoryStockInfo> stock = inventory.listStock(farmId);
    Optional<InventoryStockInfo> match = resolveArticle(stock, article);
    if (match.isEmpty()) {
      String known =
          stock.stream()
              .map(InventoryStockInfo::articleKey)
              .limit(4)
              .collect(Collectors.joining(", "));
      return InterpretResponse.clarification(
          known.isEmpty()
              ? "Aucun article en stock pour cette ferme."
              : "Quel article ? Par exemple : " + known + ".");
    }
    InventoryStockInfo item = match.get();
    long after = item.currentQuantity() + delta;
    if (after < 0) {
      return InterpretResponse.clarification(
          "Retrait impossible : seulement " + item.currentQuantity() + " en stock.");
    }

    Map<String, Object> fields = new LinkedHashMap<>();
    fields.put("articleKey", item.articleKey());
    fields.put("articleSource", item.articleSource());
    fields.put("delta", delta);
    fields.put("before", item.currentQuantity());
    fields.put("after", after);
    if (item.unit() != null) {
      fields.put("unit", item.unit());
    }
    String unit = item.unit() != null ? " " + item.unit() : "";
    return InterpretResponse.draft(
        "ADJUST_STOCK",
        null,
        fields,
        "Stock "
            + item.articleKey()
            + " : "
            + item.currentQuantity()
            + unit
            + " → "
            + after
            + unit
            + ".");
  }

  /** Exact key match, else a spoken name whose normalised form is contained in an article key. */
  private static Optional<InventoryStockInfo> resolveArticle(
      List<InventoryStockInfo> stock, String spoken) {
    String needle = normalise(spoken);
    Optional<InventoryStockInfo> exact =
        stock.stream().filter(s -> normalise(s.articleKey()).equals(needle)).findFirst();
    if (exact.isPresent()) {
      return exact;
    }
    return stock.stream().filter(s -> normalise(s.articleKey()).contains(needle)).findFirst();
  }

  private static String normalise(String s) {
    String stripped = Normalizer.normalize(s, Normalizer.Form.NFD).replaceAll("\\p{M}+", "");
    return stripped.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]+", "");
  }
}
