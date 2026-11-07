package com.avicare.livestock.poultry;

import com.avicare.livestock.domain.Breed;
import com.avicare.livestock.domain.BreedProfile;
import com.avicare.livestock.domain.PoultryBatch;
import com.avicare.livestock.dto.response.ExpectedWeightPoint;
import com.avicare.livestock.repository.BreedRepository;
import java.util.ArrayList;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Serves the same calibrated growth shape ({@link BroilerGrowthCurve}) that {@link
 * GrowthAnalysisService} scores a batch against, as a list of points a chart can draw directly — so
 * the backend's verdict and the drawn reference line can never disagree again (that disagreement is
 * why this class exists: see the class doc on {@link BroilerGrowthCurve}).
 */
@Service
@RequiredArgsConstructor
public class GrowthReferenceService {

  private static final int SAMPLE_STEP_DAYS = 7;

  private final BreedRepository breedRepository;

  /**
   * The expected weight curve for the batch, sampled every {@value #SAMPLE_STEP_DAYS} days from age
   * 0 up to {@code targetAgeDays} (always included as the last point, even when it falls off the
   * step). Never {@code null} — an empty list when there is nothing to draw: the breed's profile
   * has no growth reference ({@code BROILER_RUSTIC}), or the batch has no {@code targetWeightG}, or
   * no {@code targetAgeDays}, or a non-positive one.
   */
  @Transactional(readOnly = true)
  public List<ExpectedWeightPoint> expectedCurve(PoultryBatch batch) {
    BreedProfile profile = breedProfileOf(batch);
    if (profile != null && !profile.hasGrowthReference()) {
      return List.of();
    }
    Integer targetWeightG = batch.getTargetWeightG();
    Integer targetAgeDays = batch.getTargetAgeDays();
    if (targetWeightG == null
        || targetWeightG <= 0
        || targetAgeDays == null
        || targetAgeDays <= 0) {
      return List.of();
    }

    List<ExpectedWeightPoint> points = new ArrayList<>();
    for (int ageDays = 0; ageDays < targetAgeDays; ageDays += SAMPLE_STEP_DAYS) {
      points.add(pointAt(targetWeightG, targetAgeDays, ageDays));
    }
    points.add(pointAt(targetWeightG, targetAgeDays, targetAgeDays));
    return points;
  }

  private static ExpectedWeightPoint pointAt(int targetWeightG, int targetAgeDays, int ageDays) {
    double weightG =
        BroilerGrowthCurve.weightAt(
            targetWeightG, targetAgeDays, ageDays, GrowthAnalysisService.DAY_OLD_CHICK_WEIGHT_G);
    return new ExpectedWeightPoint(ageDays, (int) Math.round(weightG));
  }

  /**
   * Same resolution and null-handling as {@code GrowthAnalysisService.breedProfileOf}: {@code null}
   * when the batch carries no breed, the breed row is gone, or the breed was never assigned a
   * profile.
   */
  private BreedProfile breedProfileOf(PoultryBatch batch) {
    Long breedId = batch.getBreedId();
    if (breedId == null) {
      return null;
    }
    return breedRepository.findById(breedId).map(Breed::getProfile).orElse(null);
  }
}
