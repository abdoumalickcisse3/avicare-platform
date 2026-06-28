package com.avicare.livestock.production;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class ProductionStockMathTest {
  @Test
  void fullTraysFloorDivByThirty() {
    assertThat(ProductionStockMath.goodEggsToTrays(95, 5)).isEqualTo(3); // 90 bons /30 = 3
    assertThat(ProductionStockMath.goodEggsToTrays(89, 0))
        .isEqualTo(2); // 89/30 = 2 (reste 29 ignoré)
    assertThat(ProductionStockMath.goodEggsToTrays(30, 0)).isEqualTo(1);
    assertThat(ProductionStockMath.goodEggsToTrays(29, 0)).isEqualTo(0);
  }

  @Test
  void neverNegativeWhenBrokenExceedsCollected() {
    assertThat(ProductionStockMath.goodEggsToTrays(10, 25)).isEqualTo(0);
  }
}
