package com.avicare.livestock.inventory;

import java.time.LocalDate;

/**
 * Ce que l'éleveur saisit pour un paiement ou une dette de carnet.
 *
 * <p>{@code notifySupplier} porte la case « Prévenir le fournisseur » : l'interrupteur de la fiche
 * dit si l'avis est possible, cette case dit si l'éleveur le veut pour CE versement. Les deux
 * doivent être vrais. Un versement corrigeant une erreur de saisie n'a pas à partir chez le
 * fournisseur.
 */
public record SupplierLedgerCommand(
    long amountXof,
    LocalDate entryDate,
    String label,
    String method,
    String reference,
    String notes,
    boolean notifySupplier) {}
