package com.avicare.livestock.inventory;

import java.util.List;

/** Input to create/update a supplier directory entry (Sprint B4-1). */
public record SupplierCommand(
    String commercialName,
    String contactPerson,
    String phone,
    String email,
    String address,
    String city,
    List<String> types,
    String paymentTerms,
    String notes) {}
