package com.avicare.livestock.commercial.dto;

import com.avicare.livestock.commercial.ClientCommand;
import com.avicare.livestock.domain.ClientType;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

/** Create or update a client (Sprint B5-5). Same payload backs POST (create) and PUT (update). */
public record ClientRequest(
    @NotNull ClientType clientType,
    @NotBlank @Size(max = 150) String displayName,
    @Size(max = 150) String legalName,
    @Size(max = 40) String phone,
    @Email @Size(max = 120) String email,
    @Size(max = 2000) String address,
    @Size(max = 100) String city,
    @PositiveOrZero Long creditLimitXof,
    @Size(max = 80) String defaultPaymentTerms,
    @Size(max = 2000) String notes) {

  public ClientCommand toCommand() {
    return new ClientCommand(
        clientType,
        displayName,
        legalName,
        phone,
        email,
        address,
        city,
        creditLimitXof,
        defaultPaymentTerms,
        notes);
  }
}
