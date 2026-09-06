package com.avicare.livestock.controller.dto;

import java.util.List;

/** Le relevé d'un fournisseur : ses lignes, et le solde après la dernière. */
public record SupplierStatementResponse(
    Long supplierId, long balanceXof, List<SupplierLedgerEntryResponse> entries) {}
