package com.avicare.livestock.controller;

import com.avicare.common.api.response.ApiResponse;
import com.avicare.livestock.inventory.InventoryAlertService;
import com.avicare.livestock.inventory.InventoryAlertsResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Inventory alerts endpoint (Sprint B4-6) — compute-on-read aggregation (low stock, negative stock,
 * overdue purchase orders, recent movements). No notification table in V1.
 */
@RestController
@RequestMapping("/api/v1/farms/{farmId}/inventory/alerts")
@RequiredArgsConstructor
public class InventoryAlertController {

  private final InventoryAlertService inventoryAlertService;

  @GetMapping
  @PreAuthorize(InventoryAccess.READ)
  public ApiResponse<InventoryAlertsResponse> alerts(@PathVariable Long farmId) {
    return ApiResponse.of(inventoryAlertService.computeInventoryAlerts(farmId));
  }
}
