package com.avicare.assistant.read;

import com.avicare.assistant.tool.ToolParam;
import com.avicare.assistant.tool.ToolSpec;
import com.avicare.livestock.api.InventoryFacade;
import com.avicare.livestock.api.dto.InventoryStockInfo;
import java.text.Normalizer;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;
import org.springframework.stereotype.Component;

/**
 * Consult the current stock of an article (or the whole stock when none is named). Read-only: hits
 * {@link InventoryFacade} and returns a compact factual line for the model to phrase.
 */
@Component
public class StockQueryTool implements ReadTool {

  private final InventoryFacade inventory;

  public StockQueryTool(InventoryFacade inventory) {
    this.inventory = inventory;
  }

  @Override
  public ToolSpec spec() {
    return new ToolSpec(
        "STOCK_QUERY",
        "Consulter le stock actuel d'un article (ou l'ensemble du stock si aucun article n'est"
            + " précisé).",
        List.of(
            ToolParam.optional(
                "article", ToolParam.Type.STRING, "Nom ou clé de l'article, si précisé")));
  }

  @Override
  public String requiredPermission() {
    return "inventory:read";
  }

  @Override
  public String read(Long farmId, Map<String, Object> args, Long contextUnitId) {
    List<InventoryStockInfo> stock = inventory.listStock(farmId);
    if (stock.isEmpty()) {
      return "Aucun article en stock pour cette ferme.";
    }
    Object article = args.get("article");
    if (article != null && !article.toString().isBlank()) {
      Optional<InventoryStockInfo> match = resolve(stock, article.toString());
      return match
          .map(StockQueryTool::line)
          .orElse("Article introuvable au stock : " + article + ".");
    }
    return stock.stream().limit(8).map(StockQueryTool::line).collect(Collectors.joining("; "));
  }

  private static String line(InventoryStockInfo s) {
    String unit = s.unit() != null ? " " + s.unit() : "";
    return s.articleKey() + " : " + s.currentQuantity() + unit;
  }

  private static Optional<InventoryStockInfo> resolve(
      List<InventoryStockInfo> stock, String spoken) {
    String needle = normalise(spoken);
    Optional<InventoryStockInfo> exact =
        stock.stream().filter(s -> normalise(s.articleKey()).equals(needle)).findFirst();
    return exact.isPresent()
        ? exact
        : stock.stream().filter(s -> normalise(s.articleKey()).contains(needle)).findFirst();
  }

  private static String normalise(String s) {
    String stripped = Normalizer.normalize(s, Normalizer.Form.NFD).replaceAll("\\p{M}+", "");
    return stripped.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]+", "");
  }
}
