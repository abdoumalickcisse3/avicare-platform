package com.avicare.assistant.access;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.avicare.common.api.exception.ForbiddenException;
import com.avicare.parameters.api.ParametersFacade;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class AssistantAvailabilityTest {

  @Mock ParametersFacade parameters;
  @InjectMocks AssistantAvailability availability;

  private void setting(Map<String, Object> value) {
    when(parameters.resolve(any(), eq(8L), eq("farm"), eq(AssistantAvailability.SETTING_KEY)))
        .thenReturn(Optional.ofNullable(value));
  }

  @Test
  void anAbsentSettingMeansEnabled() {
    setting(null);

    // A default of off would have silently disabled a live feature for every existing farm.
    assertThat(availability.isEnabledFor(8L)).isTrue();
    assertThatCode(() -> availability.requireEnabled(8L)).doesNotThrowAnyException();
  }

  @Test
  void onlyAnExplicitFalseTurnsItOff() {
    setting(Map.of("enabled", false));
    assertThat(availability.isEnabledFor(8L)).isFalse();

    setting(Map.of("enabled", true));
    assertThat(availability.isEnabledFor(8L)).isTrue();

    // A malformed value must not read as "off" and cut a farm out by accident.
    setting(Map.of("other", "noise"));
    assertThat(availability.isEnabledFor(8L)).isTrue();
  }

  @Test
  void refusesWithAMessageTheFarmerCanActOn() {
    setting(Map.of("enabled", false));

    assertThatThrownBy(() -> availability.requireEnabled(8L))
        .isInstanceOf(ForbiddenException.class)
        // Silence would read as a bug; the message says who can undo it.
        .hasMessageContaining("Contactez le support");
  }

  @Test
  void writesTheSettingAsAnObject() {
    availability.setEnabledFor(8L, false);

    // The 3-layer store keeps JSON objects, not bare scalars.
    verify(parameters)
        .setFarmSetting(8L, AssistantAvailability.SETTING_KEY, Map.of("enabled", false));
  }
}
