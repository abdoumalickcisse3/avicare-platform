package com.avicare.assistant.access;

import com.avicare.common.api.exception.ForbiddenException;
import com.avicare.parameters.api.ParametersFacade;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Whether the assistant answers for a given farm.
 *
 * <p>Stored as a farm setting that <b>defaults to on</b>: an absent setting means enabled. A
 * default of off would have silently disabled a live feature for every existing farm the day this
 * shipped — the switch exists so staff can turn it off deliberately, not so it starts off.
 *
 * <p>Lives in the assistant context, not the console: the rule is about what the assistant does,
 * and the console is only one of the things that reads it.
 */
@Service
@RequiredArgsConstructor
public class AssistantAvailability {

  public static final String SETTING_KEY = "assistant.enabled";
  private static final String SETTING_CATEGORY = "farm";

  private final ParametersFacade parameters;

  @Transactional(readOnly = true)
  public boolean isEnabledFor(Long farmId) {
    return parameters
        .resolve(null, farmId, SETTING_CATEGORY, SETTING_KEY)
        .map(value -> !Boolean.FALSE.equals(value.get("enabled")))
        .orElse(true);
  }

  @Transactional
  public void setEnabledFor(Long farmId, boolean enabled) {
    parameters.setFarmSetting(farmId, SETTING_KEY, Map.of("enabled", enabled));
  }

  /**
   * Refuse the call when the assistant is off for this farm.
   *
   * @throws ForbiddenException with a message the farmer can act on — silence would read as a bug
   */
  public void requireEnabled(Long farmId) {
    if (!isEnabledFor(farmId)) {
      throw new ForbiddenException(
          "ASSISTANT_DISABLED",
          "L'assistant est désactivé pour cette ferme. Contactez le support pour le réactiver.");
    }
  }
}
