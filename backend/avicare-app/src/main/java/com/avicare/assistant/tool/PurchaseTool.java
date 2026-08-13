package com.avicare.assistant.tool;

import static com.avicare.assistant.tool.ToolArgs.asInt;
import static com.avicare.assistant.tool.ToolArgs.asIntOrNull;
import static com.avicare.assistant.tool.ToolArgs.asString;

import com.avicare.assistant.dto.InterpretResponse;
import com.avicare.livestock.api.InventoryFacade;
import com.avicare.livestock.api.dto.InventoryStockInfo;
import com.avicare.livestock.api.dto.SupplierInfo;
import java.text.Normalizer;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;
import org.springframework.stereotype.Component;

/**
 * Prepare a supplier purchase of a stock article (a draft purchase order). The dry-run resolves the
 * spoken article against the farm's catalog and the spoken supplier against the farm's active
 * suppliers, so the confirmation card carries the real keys/ids and shows the stock before → after;
 * the write is the existing purchase-order draft endpoint. Unlike {@link StockAdjustTool} (a bare
 * reception with no cost/supplier), this records who it was bought from and at what price.
 */
@Component
public class PurchaseTool implements AssistantTool {

  private final InventoryFacade inventory;

  public PurchaseTool(InventoryFacade inventory) {
    this.inventory = inventory;
  }

  @Override
  public ToolSpec spec() {
    return new ToolSpec(
        "PURCHASE",
        "Enregistrer un achat de stock auprès d'un fournisseur : article, quantité, prix unitaire,"
            + " fournisseur.",
        List.of(
            ToolParam.required(
                "article",
                ToolParam.Type.STRING,
                "Nom ou clé de l'article acheté (ex. « aliment »)"),
            ToolParam.required("quantity", ToolParam.Type.INTEGER, "Quantité achetée"),
            ToolParam.optional(
                "unitPriceXof", ToolParam.Type.INTEGER, "Prix unitaire en F CFA, si dit"),
            ToolParam.optional(
                "supplierName", ToolParam.Type.STRING, "Nom du fournisseur, si dit")));
  }

  @Override
  public String requiredPermission() {
    return "inventory:write";
  }

  @Override
  public InterpretResponse dryRun(Long farmId, Map<String, Object> args, Long contextUnitId) {
    int quantity = asInt(args.get("quantity"));
    if (quantity < 1) {
      return InterpretResponse.clarification("Quelle quantité avez-vous achetée ?");
    }
    String article = asString(args.get("article"));
    if (article == null) {
      return InterpretResponse.clarification("Quel article avez-vous acheté ?");
    }

    List<InventoryStockInfo> stock = inventory.listStock(farmId);
    Optional<InventoryStockInfo> item = resolveArticle(stock, article);
    if (item.isEmpty()) {
      String known =
          stock.stream()
              .map(InventoryStockInfo::articleKey)
              .limit(4)
              .collect(Collectors.joining(", "));
      return InterpretResponse.clarification(
          known.isEmpty()
              ? "Aucun article au catalogue de cette ferme."
              : "Quel article ? Par exemple : " + known + ".");
    }
    InventoryStockInfo art = item.get();

    List<SupplierInfo> suppliers = inventory.listSuppliers(farmId);
    if (suppliers.isEmpty()) {
      return InterpretResponse.clarification(
          "Aucun fournisseur enregistré — ajoutez d'abord un fournisseur.");
    }
    Optional<SupplierInfo> supplier =
        resolveSupplier(suppliers, asString(args.get("supplierName")));
    if (supplier.isEmpty()) {
      String known =
          suppliers.stream().map(SupplierInfo::name).limit(4).collect(Collectors.joining(", "));
      return InterpretResponse.clarification(
          "Auprès de quel fournisseur ? Par exemple : " + known + ".");
    }
    SupplierInfo sup = supplier.get();

    Integer unitPrice = asIntOrNull(args.get("unitPriceXof"));
    long after = art.currentQuantity() + quantity;

    Map<String, Object> fields = new LinkedHashMap<>();
    fields.put("articleKey", art.articleKey());
    fields.put("articleSource", art.articleSource());
    fields.put("quantity", quantity);
    fields.put("supplierId", sup.id());
    fields.put("supplierName", sup.name());
    fields.put("before", art.currentQuantity());
    fields.put("after", after);
    if (art.unit() != null) {
      fields.put("unit", art.unit());
    }
    if (unitPrice != null) {
      fields.put("unitPriceXof", unitPrice);
      fields.put("lineTotalXof", (long) unitPrice * quantity);
    }

    String unit = art.unit() != null ? " " + art.unit() : "";
    String price = unitPrice != null ? " à " + unitPrice + " F CFA l'unité" : "";
    return InterpretResponse.draft(
        "PURCHASE",
        null,
        fields,
        "Achat de "
            + quantity
            + unit
            + " de "
            + art.articleKey()
            + " auprès de "
            + sup.name()
            + price
            + " — stock "
            + art.currentQuantity()
            + " → "
            + after
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

  /**
   * Match the spoken supplier against a name (accent/case-insensitive, contains). When nothing is
   * said, default to the single supplier; otherwise ask.
   */
  private static Optional<SupplierInfo> resolveSupplier(
      List<SupplierInfo> suppliers, String spoken) {
    if (spoken == null) {
      return suppliers.size() == 1 ? Optional.of(suppliers.get(0)) : Optional.empty();
    }
    String needle = normalise(spoken);
    if (needle.isEmpty()) {
      return suppliers.size() == 1 ? Optional.of(suppliers.get(0)) : Optional.empty();
    }
    Optional<SupplierInfo> exact =
        suppliers.stream().filter(s -> normalise(s.name()).equals(needle)).findFirst();
    if (exact.isPresent()) {
      return exact;
    }
    return suppliers.stream().filter(s -> normalise(s.name()).contains(needle)).findFirst();
  }

  private static String normalise(String s) {
    String stripped = Normalizer.normalize(s, Normalizer.Form.NFD).replaceAll("\\p{M}+", "");
    return stripped.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]+", "");
  }
}
