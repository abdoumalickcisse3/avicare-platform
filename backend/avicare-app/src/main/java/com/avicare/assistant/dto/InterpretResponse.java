package com.avicare.assistant.dto;

import java.util.Map;

/**
 * The assistant's answer: either a validated DRAFT the human confirms (action + fields + a
 * spoken/readable summary), or a CLARIFICATION question when the intent or the lot is unclear. One
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
}
