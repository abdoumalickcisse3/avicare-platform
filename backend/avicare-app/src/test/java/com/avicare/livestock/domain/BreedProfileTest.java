package com.avicare.livestock.domain;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class BreedProfileTest {

  @Test
  void typeDeriveBroilerOuLayer() {
    assertThat(BreedProfile.BROILER_FAST.type()).isEqualTo("broiler");
    assertThat(BreedProfile.BROILER_RUSTIC.type()).isEqualTo("broiler");
    assertThat(BreedProfile.LAYER_INDUSTRIAL.type()).isEqualTo("layer");
    assertThat(BreedProfile.LAYER_RUSTIC.type()).isEqualTo("layer");
  }

  @Test
  void seulBroilerRustiqueNaPasDeCourbeDeReference() {
    assertThat(BreedProfile.BROILER_FAST.hasGrowthReference()).isTrue();
    assertThat(BreedProfile.BROILER_RUSTIC.hasGrowthReference()).isFalse();
    assertThat(BreedProfile.LAYER_INDUSTRIAL.hasGrowthReference()).isTrue();
    assertThat(BreedProfile.LAYER_RUSTIC.hasGrowthReference()).isTrue();
  }
}
