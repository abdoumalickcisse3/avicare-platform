package com.avicare.livestock.controller.dto;

import jakarta.validation.constraints.Positive;
import java.time.LocalDate;

/**
 * Ce que le client envoie pour un paiement ou une dette de carnet.
 *
 * <p>{@code notifySupplier} est un {@code Boolean} et non un {@code boolean} : un client qui l'omet
 * ne doit pas être lu comme « surtout ne préviens pas ». Absent, il vaut vrai — l'interrupteur de
 * la fiche reste seul juge.
 */
public record SupplierLedgerEntryRequest(
    @Positive(message = "amountXof must be greater than 0") long amountXof,
    LocalDate entryDate,
    String label,
    String method,
    String reference,
    String notes,
    Boolean notifySupplier) {}
