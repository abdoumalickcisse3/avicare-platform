package com.avicare.livestock.export;

import com.avicare.admin.spi.FarmDataExporter;
import com.avicare.livestock.domain.Client;
import com.avicare.livestock.domain.DailyRecord;
import com.avicare.livestock.domain.Invoice;
import com.avicare.livestock.domain.ProductionUnit;
import com.avicare.livestock.domain.Sale;
import com.avicare.livestock.domain.StockItem;
import com.avicare.livestock.repository.ClientRepository;
import com.avicare.livestock.repository.DailyRecordRepository;
import com.avicare.livestock.repository.InvoiceItemRepository;
import com.avicare.livestock.repository.InvoiceRepository;
import com.avicare.livestock.repository.ProductionUnitRepository;
import com.avicare.livestock.repository.SaleItemRepository;
import com.avicare.livestock.repository.SaleRepository;
import com.avicare.livestock.repository.StockItemRepository;
import java.util.LinkedHashMap;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * Production, commerce and stock — one exporter because they are one bounded context (ADR-008).
 *
 * <p>Line items travel with their header: a sale without its lines carries no amount, which would
 * make the export useless for the thing a farmer would actually check.
 */
@Component
@RequiredArgsConstructor
public class LivestockFarmExporter implements FarmDataExporter {

  private final ProductionUnitRepository units;
  private final DailyRecordRepository dailyRecords;
  private final ClientRepository clients;
  private final SaleRepository sales;
  private final SaleItemRepository saleItems;
  private final InvoiceRepository invoices;
  private final InvoiceItemRepository invoiceItems;
  private final StockItemRepository stockItems;

  @Override
  public String section() {
    return "livestock";
  }

  @Override
  public Map<String, Object> export(Long farmId) {
    Map<String, Object> out = new LinkedHashMap<>();
    out.put("productionUnits", units.findByFarmId(farmId).stream().map(this::unit).toList());
    out.put("clients", clients.findByFarmIdOrderById(farmId).stream().map(this::client).toList());
    out.put(
        "sales",
        sales.findByFarmIdOrderBySaleDateDescIdDesc(farmId).stream().map(this::sale).toList());
    out.put(
        "invoices",
        invoices.findByFarmIdOrderByIssueDateDescIdDesc(farmId).stream()
            .map(this::invoice)
            .toList());
    out.put("stock", stockItems.findByFarmIdOrderById(farmId).stream().map(this::stock).toList());
    return out;
  }

  private Map<String, Object> unit(ProductionUnit u) {
    Map<String, Object> row = new LinkedHashMap<>();
    row.put("id", u.getId());
    row.put("name", u.getName());
    row.put("species", u.getSpecies() == null ? null : u.getSpecies().name());
    row.put("kind", u.getUnitKind() == null ? null : u.getUnitKind().name());
    row.put("breedId", u.getBreedId());
    row.put("startDate", u.getStartDate());
    row.put("endDate", u.getEndDate());
    row.put("deletedAt", u.getDeletedAt());
    row.put(
        "dailyRecords",
        dailyRecords.findByProductionUnitIdOrderByRecordDateDesc(u.getId()).stream()
            .map(LivestockFarmExporter::dailyRecord)
            .toList());
    return row;
  }

  private static Map<String, Object> dailyRecord(DailyRecord r) {
    Map<String, Object> row = new LinkedHashMap<>();
    row.put("date", r.getRecordDate());
    row.put("mortalityCount", r.getMortalityCount());
    row.put("feedKg", r.getFeedKg());
    row.put("waterL", r.getWaterL());
    row.put("observations", r.getObservations());
    return row;
  }

  private Map<String, Object> client(Client c) {
    Map<String, Object> row = new LinkedHashMap<>();
    row.put("id", c.getId());
    row.put("displayName", c.getDisplayName());
    row.put("legalName", c.getLegalName());
    row.put("type", c.getClientType() == null ? null : c.getClientType().name());
    row.put("phone", c.getPhone());
    row.put("email", c.getEmail());
    row.put("address", c.getAddress());
    row.put("city", c.getCity());
    row.put("creditLimitXof", c.getCreditLimitXof());
    row.put("notes", c.getNotes());
    return row;
  }

  private Map<String, Object> sale(Sale s) {
    Map<String, Object> row = new LinkedHashMap<>();
    row.put("id", s.getId());
    row.put("saleNumber", s.getSaleNumber());
    row.put("date", s.getSaleDate());
    row.put("clientId", s.getClient() == null ? null : s.getClient().getId());
    row.put("paymentMethod", s.getPaymentMethod());
    row.put("salesChannel", s.getSalesChannelKey());
    row.put("cancelledAt", s.getCancelledAt());
    row.put("notes", s.getNotes());
    row.put(
        "items",
        saleItems.findBySaleIdOrderById(s.getId()).stream()
            .map(
                i -> {
                  Map<String, Object> line = new LinkedHashMap<>();
                  line.put("article", i.getArticleLabelSnapshot());
                  line.put("quantity", i.getQuantity());
                  line.put("unit", i.getUnit());
                  line.put("unitPriceXof", i.getUnitPriceXof());
                  line.put("lineTotalXof", i.getLineTotalXof());
                  return line;
                })
            .toList());
    return row;
  }

  private Map<String, Object> invoice(Invoice i) {
    Map<String, Object> row = new LinkedHashMap<>();
    row.put("id", i.getId());
    row.put("invoiceNumber", i.getInvoiceNumber());
    row.put("issueDate", i.getIssueDate());
    row.put("dueDate", i.getDueDate());
    row.put("clientId", i.getClient() == null ? null : i.getClient().getId());
    row.put("sourceType", i.getSourceType() == null ? null : i.getSourceType().name());
    row.put("cancelledAt", i.getCancelledAt());
    row.put(
        "items",
        invoiceItems.findByInvoiceIdOrderById(i.getId()).stream()
            .map(
                item -> {
                  Map<String, Object> line = new LinkedHashMap<>();
                  line.put("label", item.getArticleLabelSnapshot());
                  line.put("unit", item.getUnit());
                  line.put("quantity", item.getQuantity());
                  line.put("unitPriceXof", item.getUnitPriceXof());
                  line.put("lineTotalXof", item.getLineTotalXof());
                  return line;
                })
            .toList());
    return row;
  }

  private Map<String, Object> stock(StockItem s) {
    Map<String, Object> row = new LinkedHashMap<>();
    row.put("articleKey", s.getArticleKey());
    row.put("unit", s.getUnit());
    row.put("currentQuantity", s.getCurrentQuantity());
    row.put("alertThreshold", s.getAlertThreshold());
    row.put("lastMovementAt", s.getLastMovementAt());
    row.put("active", s.isActive());
    return row;
  }
}
