package com.avicare.livestock.commercial;

import com.avicare.livestock.domain.ClientType;

/**
 * Input to create or update a {@link com.avicare.livestock.domain.Client} (Sprint B5-1). {@code
 * creditLimitXof} null means no limit (D26 — indicative, never blocks). The receivable balance is
 * NOT set here; it is owned by payment operations (B5-4).
 */
public record ClientCommand(
    ClientType clientType,
    String displayName,
    String legalName,
    String phone,
    String email,
    String address,
    String city,
    Long creditLimitXof,
    String defaultPaymentTerms,
    String notes) {}
