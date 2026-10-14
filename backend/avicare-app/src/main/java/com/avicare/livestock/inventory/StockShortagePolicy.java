package com.avicare.livestock.inventory;

import com.avicare.parameters.api.ParametersFacade;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Une sortie peut-elle faire passer le stock de cette ferme sous zéro ?
 *
 * <p>Réglage de ferme à <b>true</b> par défaut : non. C'est la révision de la décision 19
 * (ADR-018). Un solde négatif n'est pas un avertissement, c'est un chiffre faux qui se propage — il
 * entre dans la valorisation du stock, donc dans les coûts, donc dans le résultat. Un éleveur
 * pilote l'a signalé en voyant son charbon à −1 sac valorisé −6 100 F.
 *
 * <p>Le réglage existe pour qu'une ferme qui travaille autrement puisse revenir en arrière sans
 * attendre une livraison — il se change par l'API générique des réglages de ferme, réservée aux
 * OWNER/MANAGER. Il ne démarre pas éteint : le défaut protège le chiffre.
 *
 * <p>Une valeur stockée illisible rend {@code true}. Une garde qui s'ouvrirait sur une donnée
 * abîmée serait pire qu'inutile : elle laisserait passer sans que personne l'ait décidé.
 */
@Service
@RequiredArgsConstructor
public class StockShortagePolicy {

  public static final String SETTING_KEY = "inventory.block_negative_stock";
  private static final String SETTING_CATEGORY = "farm";

  private final ParametersFacade parameters;

  @Transactional(readOnly = true)
  public boolean isBlockingFor(Long farmId) {
    return parameters
        .resolve(null, farmId, SETTING_CATEGORY, SETTING_KEY)
        .map(value -> !Boolean.FALSE.equals(value.get("blocking")))
        .orElse(true);
  }

  @Transactional
  public void setBlockingFor(Long farmId, boolean blocking) {
    parameters.setFarmSetting(farmId, SETTING_KEY, Map.of("blocking", blocking));
  }
}
