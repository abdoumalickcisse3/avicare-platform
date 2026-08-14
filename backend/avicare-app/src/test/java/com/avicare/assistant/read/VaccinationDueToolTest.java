package com.avicare.assistant.read;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import com.avicare.livestock.health.HealthFacade;
import com.avicare.livestock.health.VaccinationDueInfo;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class VaccinationDueToolTest {

  @Mock private HealthFacade health;

  private VaccinationDueTool tool() {
    return new VaccinationDueTool(health);
  }

  @Test
  void listsDueVaccinationsWithLateness() {
    when(health.dueVaccinations(1L))
        .thenReturn(
            List.of(
                new VaccinationDueInfo("B-12", "newcastle", LocalDate.now().minusDays(3), 3),
                new VaccinationDueInfo("Pondeuses A", "gumboro", LocalDate.now(), 0)));

    String r = tool().read(1L, Map.of(), null);

    assertThat(r).contains("B-12").contains("newcastle").contains("retard de 3");
    assertThat(r).contains("Pondeuses A").contains("gumboro");
  }

  @Test
  void nothingDue_saysSo() {
    when(health.dueVaccinations(1L)).thenReturn(List.of());

    String r = tool().read(1L, Map.of(), null);

    assertThat(r).contains("Aucune vaccination en retard");
  }
}
