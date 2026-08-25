package com.avicare.partner.dto.request;

/**
 * Partial update of a partner (admin). PATCH semantics: a {@code null} field is left untouched, so
 * setting only {@code logoUrl} — the co-branding case — cannot wipe the contact details.
 */
public record UpdatePartnerRequest(
    String name, String contactName, String contactPhone, String contactEmail, String logoUrl) {}
