package com.avicare.assistant.read;

import com.avicare.assistant.tool.ToolSpec;
import com.avicare.livestock.health.HealthFacade;
import com.avicare.livestock.health.VaccinationDueInfo;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.stereotype.Component;

/**
 * Consult which vaccinations are due/overdue on the farm's lots. Read-only: hits {@link
 * HealthFacade#dueVaccinations}.
 */
@Component
public class VaccinationDueTool implements ReadTool {

  private final HealthFacade health;

  public VaccinationDueTool(HealthFacade health) {
    this.health = health;
  }

  @Override
  public ToolSpec spec() {
    return new ToolSpec(
        "VACCINATION_DUE",
        "Consulter les vaccinations dues ou en retard sur les lots de la ferme.",
        List.of());
  }

  @Override
  public String requiredPermission() {
    return "health:read";
  }

  @Override
  public String read(Long farmId, Map<String, Object> args, Long contextUnitId) {
    List<VaccinationDueInfo> due = health.dueVaccinations(farmId);
    if (due.isEmpty()) {
      return "Aucune vaccination en retard.";
    }
    return due.stream().limit(8).map(VaccinationDueTool::line).collect(Collectors.joining("; "));
  }

  private static String line(VaccinationDueInfo v) {
    String late = v.daysLate() > 0 ? " (en retard de " + v.daysLate() + " j)" : "";
    return "lot " + v.unitName() + " : " + v.vaccineKey() + " dû le " + v.dueDate() + late;
  }
}
