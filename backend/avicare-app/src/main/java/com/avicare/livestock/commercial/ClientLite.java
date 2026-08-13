package com.avicare.livestock.commercial;

/**
 * Minimal public view of a client for name resolution (doc 03 §4.9): the id, the {@code
 * displayName} to match a spoken name against, and the running receivable ({@code
 * currentBalanceXof}, may be negative when in advance). Exposed through {@link CommercialFacade} so
 * the assistant can resolve "le client Diallo" without touching the commercial entities.
 */
public record ClientLite(Long clientId, String displayName, long currentBalanceXof) {}
