package com.avicare.assistant.dto;

import java.util.Map;
import java.util.Set;

/**
 * The assistant's answer: a validated DRAFT the human confirms (action + fields + a spoken/readable
 * summary + a {@code risk} level to colour the confirmation card), a CLARIFICATION question when
 * the intent or the lot is unclear, or an ANSWER (a read-only consultation the agentic loop
 * produced — nothing to confirm, just information). One shape keeps the mobile client simple.
 *
 * <p>{@code risk} is {@code LOW} | {@code MEDIUM} | {@code HIGH} for a DRAFT, {@code null}
 * otherwise — derived from the action (money moves rank highest), so the tools don't carry it.
 */
public record InterpretResponse(
    String kind,
    String action,
    Long unitId,
    Map<String, Object> fields,
    String summary,
    String message,
    String risk,
    String claimId) {

  private static final Set<String> HIGH_RISK = Set.of("RECORD_PAYMENT", "QUICK_SALE", "PURCHASE");
  private static final Set<String> MEDIUM_RISK =
      Set.of("MORTALITY", "ADJUST_STOCK", "VACCINATION", "CREATE_LOT");

  public static InterpretResponse draft(
      String action, Long unitId, Map<String, Object> fields, String summary) {
    return new InterpretResponse(
        "DRAFT", action, unitId, fields, summary, null, riskOf(action), null);
  }

  public static InterpretResponse clarification(String message) {
    return new InterpretResponse("CLARIFICATION", null, null, null, null, message, null, null);
  }

  /** A read-only answer produced by the consultation loop; carried in {@code message}. */
  public static InterpretResponse answer(String message) {
    return new InterpretResponse("ANSWER", null, null, null, null, message, null, null);
  }

  /** A copy carrying the server-confirm claim id (set on a DRAFT by the controller). */
  public InterpretResponse withClaimId(String claim) {
    return new InterpretResponse(kind, action, unitId, fields, summary, message, risk, claim);
  }

  /** Coarse risk of confirming an action, to colour the mobile card. */
  private static String riskOf(String action) {
    if (action == null) {
      return "LOW";
    }
    if (HIGH_RISK.contains(action)) {
      return "HIGH";
    }
    return MEDIUM_RISK.contains(action) ? "MEDIUM" : "LOW";
  }
}
