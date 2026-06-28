package com.avicare.livestock.production;

/** Pure conversions for production stock. */
public final class ProductionStockMath {
  private ProductionStockMath() {}

  /** Full 30-egg trays produced from a day's collection (remainder &lt; 30 ignored, V1). */
  public static int goodEggsToTrays(int collected, int broken) {
    int good = Math.max(collected - broken, 0);
    return good / 30;
  }
}
