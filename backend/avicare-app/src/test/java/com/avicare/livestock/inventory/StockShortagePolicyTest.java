package com.avicare.livestock.inventory;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.avicare.parameters.api.ParametersFacade;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

/**
 * Le réglage de ferme qui décide si une sortie peut faire passer le stock sous zéro.
 *
 * <p>Il est à <b>true</b> par défaut : la plateforme refuse. C'est l'inverse du réglage de
 * l'assistant, et c'est voulu — ici le défaut protège le chiffre, alors que là-bas il protégeait
 * une fonctionnalité déjà en service. Le réglage existe pour qu'une ferme qui travaille autrement
 * puisse revenir en arrière sans attendre une livraison, pas pour que la garde démarre éteinte.
 */
@ExtendWith(MockitoExtension.class)
class StockShortagePolicyTest {

  @Mock ParametersFacade parameters;

  private StockShortagePolicy policy() {
    return new StockShortagePolicy(parameters);
  }

  @Test
  void blocksWhenNothingWasEverSet() {
    when(parameters.resolve(null, 7L, "farm", StockShortagePolicy.SETTING_KEY))
        .thenReturn(Optional.empty());

    assertThat(policy().isBlockingFor(7L)).isTrue();
  }

  @Test
  void letsTheFarmTurnItOff() {
    when(parameters.resolve(null, 7L, "farm", StockShortagePolicy.SETTING_KEY))
        .thenReturn(Optional.of(Map.of("blocking", false)));

    assertThat(policy().isBlockingFor(7L)).isFalse();
  }

  @Test
  void blocksAgainWhenTheFarmTurnsItBackOn() {
    when(parameters.resolve(null, 7L, "farm", StockShortagePolicy.SETTING_KEY))
        .thenReturn(Optional.of(Map.of("blocking", true)));

    assertThat(policy().isBlockingFor(7L)).isTrue();
  }

  /** Une valeur abîmée ne doit pas ouvrir la garde en silence. */
  @Test
  void blocksWhenTheStoredValueMakesNoSense() {
    when(parameters.resolve(null, 7L, "farm", StockShortagePolicy.SETTING_KEY))
        .thenReturn(Optional.of(Map.of("blocking", "peut-être")));

    assertThat(policy().isBlockingFor(7L)).isTrue();
  }

  @Test
  void writesTheSettingAsAFarmLayerValue() {
    policy().setBlockingFor(7L, false);

    verify(parameters)
        .setFarmSetting(7L, StockShortagePolicy.SETTING_KEY, Map.of("blocking", false));
  }
}
