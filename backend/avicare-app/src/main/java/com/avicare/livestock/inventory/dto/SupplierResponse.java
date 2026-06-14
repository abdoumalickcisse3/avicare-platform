package com.avicare.livestock.inventory.dto;

import com.avicare.livestock.domain.Supplier;
import java.util.List;

/** A supplier directory entry (Sprint B4-6). */
public record SupplierResponse(
    Long id,
    Long farmId,
    String commercialName,
    String contactPerson,
    String phone,
    String email,
    String address,
    String city,
    List<String> types,
    String paymentTerms,
    String notes,
    boolean active) {

  public static SupplierResponse from(Supplier s) {
    return new SupplierResponse(
        s.getId(),
        s.getFarmId(),
        s.getCommercialName(),
        s.getContactPerson(),
        s.getPhone(),
        s.getEmail(),
        s.getAddress(),
        s.getCity(),
        s.getTypes(),
        s.getPaymentTerms(),
        s.getNotes(),
        s.isActive());
  }
}
