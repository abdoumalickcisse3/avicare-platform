package com.avicare.livestock.commercial.dto;

import com.avicare.livestock.domain.Client;
import com.avicare.livestock.domain.ClientType;

/** Public view of a client (Sprint B5-5). */
public record ClientResponse(
    Long id,
    Long farmId,
    ClientType clientType,
    String displayName,
    String legalName,
    String phone,
    String email,
    String address,
    String city,
    Long creditLimitXof,
    long currentBalanceXof,
    String defaultPaymentTerms,
    boolean active,
    String notes) {

  public static ClientResponse from(Client c) {
    return new ClientResponse(
        c.getId(),
        c.getFarmId(),
        c.getClientType(),
        c.getDisplayName(),
        c.getLegalName(),
        c.getPhone(),
        c.getEmail(),
        c.getAddress(),
        c.getCity(),
        c.getCreditLimitXof(),
        c.getCurrentBalanceXof(),
        c.getDefaultPaymentTerms(),
        c.isActive(),
        c.getNotes());
  }
}
