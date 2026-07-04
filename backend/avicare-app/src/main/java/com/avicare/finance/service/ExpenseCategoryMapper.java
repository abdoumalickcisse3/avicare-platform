package com.avicare.finance.service;

/**
 * Maps a raw article (inventory source + subcategory) to an expense category key.
 *
 * <p>Pure, static, no dependency on the livestock/inventory bounded context — callers resolve
 * {@code articleSource}/{@code subcategory} from their own catalog before calling here.
 */
public final class ExpenseCategoryMapper {

  private ExpenseCategoryMapper() {}

  /** Maps an article (source + subcategory, raw strings) to an expense category key. */
  public static String expenseCategoryFor(String articleSource, String subcategory) {
    if ("TREATMENT".equals(articleSource)) return "veterinary";
    if (subcategory == null) return "other";
    return switch (subcategory) {
      case "FEED" -> "feed";
      case "MEDICATION" -> "veterinary";
      case "EQUIPMENT" -> "equipment";
      default -> "other";
    };
  }
}
