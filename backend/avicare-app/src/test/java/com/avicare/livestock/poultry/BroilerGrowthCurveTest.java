package com.avicare.livestock.poultry;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

/**
 * The curve replaces a straight line. The tests that matter are the ones that separate the two:
 * mid-cycle, and above all in the first fortnight, where the line demanded roughly twice the weight
 * a chick actually has.
 */
class BroilerGrowthCurveTest {

  private static final int CHICK_G = 40;

  @Test
  void startsAtTheChickWeight() {
    assertThat(BroilerGrowthCurve.weightAt(2000, 42, 0, CHICK_G)).isEqualTo(40.0);
  }

  @Test
  void reachesExactlyTheTargetOnTheTargetDay() {
    assertThat(BroilerGrowthCurve.weightAt(2000, 42, 42, CHICK_G)).isEqualTo(2000.0);
  }

  @Test
  void holdsTheTargetPastTheTargetDay() {
    assertThat(BroilerGrowthCurve.weightAt(2000, 42, 50, CHICK_G)).isEqualTo(2000.0);
  }

  @Test
  void atDaySeven_asksForAboutAHundredAndFiftyGrams_notThreeHundredAndSixty() {
    // The straight line asked 40 + 1960 x (7/42) = 366 g of a seven-day-old chick, so every batch
    // read BEHIND for its first fortnight. A Cobb 500 or Ross 308 has done 5.5 % of its total gain
    // at a sixth of the cycle.
    double target = BroilerGrowthCurve.weightAt(2000, 42, 7, CHICK_G);

    assertThat(target).isCloseTo(147.8, org.assertj.core.data.Offset.offset(0.5));
    assertThat(target).isLessThan(366.0);
  }

  @Test
  void atMidCycle_asksForAThirdOfTheGain_notAHalf() {
    // 32.5 % of the gain at half the cycle: 40 + 1960 x 0.325 = 677 g, where the line said 1020 g.
    assertThat(BroilerGrowthCurve.weightAt(2000, 42, 21, CHICK_G))
        .isCloseTo(677.0, org.assertj.core.data.Offset.offset(1.0));
  }

  @Test
  void interpolatesBetweenTwoAnchors() {
    // Day 10 of 42 sits between the sixth (0.055) and the third (0.160) of the cycle.
    double d7 = BroilerGrowthCurve.weightAt(2000, 42, 7, CHICK_G);
    double d10 = BroilerGrowthCurve.weightAt(2000, 42, 10, CHICK_G);
    double d14 = BroilerGrowthCurve.weightAt(2000, 42, 14, CHICK_G);

    assertThat(d10).isGreaterThan(d7).isLessThan(d14);
  }

  @Test
  void growsWithoutEverGoingBackwards() {
    double previous = -1;
    for (int day = 0; day <= 42; day++) {
      double w = BroilerGrowthCurve.weightAt(2200, 42, day, CHICK_G);
      assertThat(w).as("day %d", day).isGreaterThanOrEqualTo(previous);
      previous = w;
    }
  }

  @Test
  void keepsTheSameShapeWhateverTheCycleLength() {
    // A 35-day cycle and a 49-day one are read at the same fraction of their own length.
    double shortCycle = BroilerGrowthCurve.weightAt(2000, 35, 35 / 2, CHICK_G);
    double longCycle = BroilerGrowthCurve.weightAt(2000, 49, 49 / 2, CHICK_G);

    assertThat(shortCycle).isCloseTo(longCycle, org.assertj.core.data.Offset.offset(15.0));
  }

  @Test
  void refusesToGuessWithoutATarget() {
    assertThat(BroilerGrowthCurve.weightAt(0, 42, 10, CHICK_G)).isNull();
    assertThat(BroilerGrowthCurve.weightAt(2000, 0, 10, CHICK_G)).isNull();
    assertThat(BroilerGrowthCurve.weightAt(2000, -1, 10, CHICK_G)).isNull();
  }

  @Test
  void neverAsksMoreThanTheTarget() {
    // A target below the chick weight is nonsense, but it must not produce a curve that dips or
    // overshoots: the batch simply sits at its target.
    assertThat(BroilerGrowthCurve.weightAt(30, 42, 20, CHICK_G)).isLessThanOrEqualTo(40.0);
  }
}
