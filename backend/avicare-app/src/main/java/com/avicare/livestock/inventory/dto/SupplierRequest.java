package com.avicare.livestock.inventory.dto;

import com.avicare.livestock.inventory.SupplierCommand;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.List;

/** Create or update a supplier directory entry (Sprint B4-6). */
public record SupplierRequest(
    @NotBlank @Size(max = 200) String commercialName,
    @Size(max = 200) String contactPerson,
    @Size(max = 40) String phone,
    @Email @Size(max = 200) String email,
    @Size(max = 300) String address,
    @Size(max = 120) String city,
    List<String> types,
    @Size(max = 200) String paymentTerms,
    @Size(max = 2000) String notes) {

  public SupplierCommand toCommand() {
    return new SupplierCommand(
        commercialName,
        contactPerson,
        phone,
        email,
        address,
        city,
        types == null ? List.of() : types,
        paymentTerms,
        notes);
  }
}
