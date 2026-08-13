package com.avicare.assistant.dto;

import java.util.Map;

/**
 * The assistant's answer: a validated DRAFT the human confirms (action + fields + a spoken/readable
 * summary), a CLARIFICATION question when the intent or the lot is unclear, or an ANSWER (a
 * read-only consultation the agentic loop produced — nothing to confirm, just information). One
 * shape keeps the mobile client simple.
 */
public record InterpretResponse(
    String kind,
    String action,
    Long unitId,
    Map<String, Object> fields,
    String summary,
    String message) {

  public static InterpretResponse draft(
      String action, Long unitId, Map<String, Object> fields, String summary) {
    return new InterpretResponse("DRAFT", action, unitId, fields, summary, null);
  }

  public static InterpretResponse clarification(String message) {
    return new InterpretResponse("CLARIFICATION", null, null, null, null, message);
  }

  /** A read-only answer produced by the consultation loop; carried in {@code message}. */
  public static InterpretResponse answer(String message) {
    return new InterpretResponse("ANSWER", null, null, null, null, message);
  }
}
