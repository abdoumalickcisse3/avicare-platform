package com.avicare.livestock.inventory;

/** Le solde d'un fournisseur. Positif : la ferme doit. Négatif : elle a payé d'avance. */
public record SupplierBalance(Long supplierId, String supplierName, long balanceXof) {}
