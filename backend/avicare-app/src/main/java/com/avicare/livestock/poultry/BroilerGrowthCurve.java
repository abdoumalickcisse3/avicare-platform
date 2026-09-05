package com.avicare.livestock.poultry;

/**
 * The weight a broiler batch is expected to have reached at a given age.
 *
 * <p>This used to be a straight line between a day-old chick and the batch's target. A broiler does
 * not grow in a straight line: it gains 5 % of its total gain in the first sixth of the cycle and a
 * quarter of it in the last sixth. The line therefore demanded roughly twice the real weight during
 * the first fortnight, and every batch was scored BEHIND while it was in fact on target — at
 * exactly the moment a farmer reacts, by over-feeding or by medicating.
 *
 * <p>What is stable across the catalogue's two broiler strains is the <em>shape</em>, not the
 * weights. Normalised as "share of the total gain reached at this share of the cycle", the
 * published Cobb 500 and Ross 308 as-hatched standards agree to within a point:
 *
 * <pre>
 *   share of cycle   1/6     1/3     1/2     2/3     5/6
 *   Cobb 500        0.055   0.160   0.323   0.526   0.756
 *   Ross 308        0.055   0.160   0.327   0.531   0.760
 * </pre>
 *
 * <p>So the shape is fixed here and the scale comes from the farmer: the batch's own {@code
 * target_weight_g} at {@code target_age_days}. Nothing is invented about a breed, and a farm's own
 * strain is served as well as a catalogue one.
 *
 * <p>{@code breeds.growth_curve} (JSONB, migration V5) was meant to hold true per-breed standards.
 * It is empty on every row and nothing reads it. Populating it is the way to make this more precise
 * than a shared shape — and this class is where that lookup belongs when the data exists.
 */
final class BroilerGrowthCurve {

  /** Share of the cycle, paired with the share of the total gain reached by then. */
  private static final double[][] SHAPE = {
    {0.0 / 6, 0.000},
    {1.0 / 6, 0.055},
    {2.0 / 6, 0.160},
    {3.0 / 6, 0.325},
    {4.0 / 6, 0.529},
    {5.0 / 6, 0.758},
    {6.0 / 6, 1.000},
  };

  private BroilerGrowthCurve() {}

  /**
   * Expected weight in grams at {@code ageDays}, or null when the batch declares no target to scale
   * the shape against. Ages beyond the target day hold the target rather than extrapolating: past
   * its own finish line a batch is late for sale, not underweight.
   */
  static Double weightAt(int targetWeightG, int targetAgeDays, int ageDays, int chickWeightG) {
    if (targetWeightG <= 0 || targetAgeDays <= 0) {
      return null;
    }
    if (ageDays >= targetAgeDays) {
      return (double) targetWeightG;
    }
    if (ageDays <= 0) {
      return (double) Math.min(chickWeightG, targetWeightG);
    }
    double gain = targetWeightG - chickWeightG;
    if (gain <= 0) {
      return (double) targetWeightG;
    }
    return chickWeightG + gain * shareOfGainAt((double) ageDays / targetAgeDays);
  }

  /** Linear interpolation between the two anchors surrounding {@code cycleShare}. */
  private static double shareOfGainAt(double cycleShare) {
    for (int i = 1; i < SHAPE.length; i++) {
      double upperShare = SHAPE[i][0];
      if (cycleShare <= upperShare) {
        double lowerShare = SHAPE[i - 1][0];
        double span = upperShare - lowerShare;
        double within = span == 0 ? 0 : (cycleShare - lowerShare) / span;
        return SHAPE[i - 1][1] + within * (SHAPE[i][1] - SHAPE[i - 1][1]);
      }
    }
    return 1.0;
  }
}
