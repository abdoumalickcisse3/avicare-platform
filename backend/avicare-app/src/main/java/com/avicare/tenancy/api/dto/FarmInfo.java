package com.avicare.tenancy.api.dto;

/**
 * Public, cross-context view of a farm, exposed via {@link com.avicare.tenancy.api.TenancyFacade}.
 * Other bounded contexts depend on this record, never on the {@code Farm} entity.
 */
public record FarmInfo(Long id, String name, String currency, String timezone, boolean active) {}
