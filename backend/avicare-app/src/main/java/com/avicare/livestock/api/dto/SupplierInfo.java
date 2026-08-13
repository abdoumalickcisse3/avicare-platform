package com.avicare.livestock.api.dto;

/**
 * Public, cross-context view of an active supplier: the id and the {@code name} (commercial name)
 * to match a spoken supplier against. Exposed through {@link
 * com.avicare.livestock.api.InventoryFacade} so the assistant can resolve "chez Aliments du Sahel"
 * to a supplier id without touching the inventory entities.
 */
public record SupplierInfo(Long id, String name) {}
