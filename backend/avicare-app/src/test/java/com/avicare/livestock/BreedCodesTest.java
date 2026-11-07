package com.avicare.livestock;

import static org.assertj.core.api.Assertions.assertThat;

import com.avicare.livestock.service.BreedCodes;
import org.junit.jupiter.api.Test;

/**
 * Pure unit test, no Spring context: proves {@link BreedCodes#slugify} on its own, so it keeps
 * running on a machine where Testcontainers can't boot (see project memory).
 */
class BreedCodesTest {

  @Test
  void les_accents_et_les_espaces_tombent() {
    assertThat(BreedCodes.slugify("Locale améliorée")).isEqualTo("locale_amelioree");
  }

  @Test
  void un_nom_sans_aucune_lettre_donne_une_chaine_vide() {
    assertThat(BreedCodes.slugify("— ??? —")).isEmpty();
  }
}
