package com.avicare.livestock.inventory;

import com.avicare.livestock.domain.LedgerDirection;
import com.avicare.livestock.domain.LedgerSource;
import java.time.LocalDate;

/**
 * Une ligne de relevé, avec le solde après elle.
 *
 * <p>Le solde progressif est calculé côté serveur : deux clients qui recalculeraient la même
 * colonne seraient deux occasions de diverger.
 */
public record SupplierStatementLine(
    Long id,
    LocalDate entryDate,
    LedgerDirection direction,
    LedgerSource source,
    long amountXof,
    String label,
    String method,
    String reference,
    Long purchaseOrderId,
    long runningBalanceXof) {}
