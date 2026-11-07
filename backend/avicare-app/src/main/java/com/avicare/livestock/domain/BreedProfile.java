package com.avicare.livestock.domain;

/**
 * Le profil de production d'une souche : ce qui détermine ses cibles par défaut (poids, âge) et si
 * une courbe de croissance de référence existe. Permet de déclarer une souche hors catalogue
 * (Goliath, Kuroiler, "locale améliorée") sans lui inventer une fiche technique propre — elle
 * emprunte le profil d'une famille connue.
 *
 * <p>{@link #hasGrowthReference()} fait foi pour {@code GrowthAnalysisService} : lire l'équivalent
 * dans le catalogue {@code breed_profiles} depuis ce service tirerait {@code ParametersFacade} dans
 * un contexte slicé par {@code @DataJpaTest}, ce qu'on évite en gardant une seule source de vérité
 * sur l'enum.
 */
public enum BreedProfile {
  BROILER_FAST,
  BROILER_RUSTIC,
  LAYER_INDUSTRIAL,
  LAYER_RUSTIC;

  /** {@code "broiler"} pour les profils de chair, {@code "layer"} pour les profils de ponte. */
  public String type() {
    return switch (this) {
      case BROILER_FAST, BROILER_RUSTIC -> "broiler";
      case LAYER_INDUSTRIAL, LAYER_RUSTIC -> "layer";
    };
  }

  /**
   * Faux uniquement pour {@link #BROILER_RUSTIC} : les souches rustiques/locales n'ont pas de
   * courbe de croissance de référence validée (spec §7.1) — leur suivi se limite aux pesées
   * saisies, sans comparaison à une référence.
   */
  public boolean hasGrowthReference() {
    return this != BROILER_RUSTIC;
  }
}
