package com.avicare.admin.dto.response;

/**
 * One farm ranked by how likely it is to churn.
 *
 * <p>{@code reason} is ready-to-display French: the console shows why a farm is flagged, because a
 * level alone tells support nothing about what to say when they call.
 */
public record FarmHealthRow(
    Long farmId, String name, String level, Long daysSinceLastEntry, String reason) {

  public static final String OK = "OK";
  public static final String WATCH = "WATCH";
  public static final String AT_RISK = "AT_RISK";
}
