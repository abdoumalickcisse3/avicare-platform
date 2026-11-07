package com.avicare.livestock.poultry;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import com.avicare.livestock.domain.Breed;
import com.avicare.livestock.domain.BreedProfile;
import com.avicare.livestock.domain.PoultryBatch;
import com.avicare.livestock.dto.response.ExpectedWeightPoint;
import com.avicare.livestock.repository.BreedRepository;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

/**
 * The server is the only place that knows the calibrated growth shape ({@link BroilerGrowthCurve}).
 * Both charts (web and mobile) must draw this curve rather than interpolate their own straight line
 * between the day-old chick and the target — see {@code GrowthAnalysisTargetScoreTest} for why a
 * straight line is wrong for the whole first fortnight.
 */
class GrowthReferenceServiceTest {

  private static final Long BREED_ID = 7L;

  private BreedRepository breedRepository;
  private GrowthReferenceService service;

  @BeforeEach
  void setUp() {
    breedRepository = Mockito.mock(BreedRepository.class);
    service = new GrowthReferenceService(breedRepository);
  }

  private PoultryBatch batch(Integer targetWeightG, Integer targetAgeDays) {
    PoultryBatch b = new PoultryBatch();
    b.setBreedId(BREED_ID);
    b.setTargetWeightG(targetWeightG);
    b.setTargetAgeDays(targetAgeDays);
    return b;
  }

  private void breedHasProfile(BreedProfile profile) {
    Breed breed = new Breed();
    breed.setProfile(profile);
    when(breedRepository.findById(BREED_ID)).thenReturn(Optional.of(breed));
  }

  private ExpectedWeightPoint pointAt(List<ExpectedWeightPoint> curve, int ageDays) {
    return curve.stream()
        .filter(p -> p.ageDays() == ageDays)
        .findFirst()
        .orElseThrow(() -> new AssertionError("no point at age " + ageDays));
  }

  @Test
  void la_courbe_suit_la_forme_calibree_et_non_une_droite() {
    breedHasProfile(BreedProfile.BROILER_FAST);
    PoultryBatch batch = batch(2100, 42);

    List<ExpectedWeightPoint> curve = service.expectedCurve(batch);

    // cible 2100 g à 42 j : au 7e jour la forme donne ~5,5 % du gain, pas 1/6
    assertThat(pointAt(curve, 7).weightG()).isLessThan(500);
  }

  @Test
  void la_courbe_part_du_poussin_et_finit_sur_la_cible() {
    breedHasProfile(BreedProfile.BROILER_FAST);
    PoultryBatch batch = batch(2100, 42);

    List<ExpectedWeightPoint> curve = service.expectedCurve(batch);

    assertThat(curve.get(0).ageDays()).isZero();
    assertThat(curve.get(curve.size() - 1).weightG()).isEqualTo(2100);
  }

  @Test
  void un_profil_rustique_ne_donne_aucune_courbe() {
    breedHasProfile(BreedProfile.BROILER_RUSTIC);
    PoultryBatch batch = batch(1500, 90);

    List<ExpectedWeightPoint> curve = service.expectedCurve(batch);

    assertThat(curve).isEmpty();
  }

  @Test
  void une_souche_sans_profil_garde_la_forme_calibree() {
    when(breedRepository.findById(BREED_ID)).thenReturn(Optional.empty());
    PoultryBatch batch = batch(2100, 42);

    List<ExpectedWeightPoint> curve = service.expectedCurve(batch);

    assertThat(curve).isNotEmpty(); // RF #3
  }

  @Test
  void un_age_cible_nul_ou_negatif_ne_donne_aucune_courbe() {
    breedHasProfile(BreedProfile.BROILER_FAST);

    assertThat(service.expectedCurve(batch(2100, null))).isEmpty();
    assertThat(service.expectedCurve(batch(2100, 0))).isEmpty();
    assertThat(service.expectedCurve(batch(2100, -1))).isEmpty(); // RF #4
  }

  @Test
  void une_cible_absente_ne_donne_aucune_courbe() {
    breedHasProfile(BreedProfile.BROILER_FAST);
    PoultryBatch batch = batch(null, 42);

    List<ExpectedWeightPoint> curve = service.expectedCurve(batch);

    assertThat(curve).isEmpty();
  }
}
