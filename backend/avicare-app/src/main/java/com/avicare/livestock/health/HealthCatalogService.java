package com.avicare.livestock.health;

import com.avicare.common.api.exception.NotFoundException;
import com.avicare.parameters.api.ParametersFacade;
import com.avicare.parameters.api.dto.CatalogEntryInfo;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Read-only access to the health library (Sprint B3-1): vaccines, treatments and standard
 * vaccination programs. The data is platform catalog (Décision 15) read through {@link
 * ParametersFacade#listPlatform} (Décision 16) — no entity, no repository. Farm-level
 * customizations (custom vaccines, cloned programs) come in B3-2.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class HealthCatalogService {

  static final String CAT_VACCINES = "vaccines";
  static final String CAT_TREATMENTS = "treatments";
  static final String CAT_PROGRAMS = "vaccination_programs";

  private final ParametersFacade parametersFacade;

  public List<VaccineDto> listVaccines(Long farmId) {
    return parametersFacade.listForFarm(farmId, CAT_VACCINES).stream()
        .map(HealthCatalogService::toVaccine)
        .toList();
  }

  public List<TreatmentDto> listTreatments(Long farmId) {
    return parametersFacade.listForFarm(farmId, CAT_TREATMENTS).stream()
        .map(HealthCatalogService::toTreatment)
        .toList();
  }

  @Transactional
  public VaccineDto saveVaccine(Long farmId, String key, Map<String, Object> value) {
    return toVaccine(parametersFacade.override(farmId, CAT_VACCINES, key, value));
  }

  @Transactional
  public void deleteVaccine(Long farmId, String key) {
    parametersFacade.delete(farmId, CAT_VACCINES, key);
  }

  @Transactional
  public TreatmentDto saveTreatment(Long farmId, String key, Map<String, Object> value) {
    return toTreatment(parametersFacade.override(farmId, CAT_TREATMENTS, key, value));
  }

  @Transactional
  public void deleteTreatment(Long farmId, String key) {
    parametersFacade.delete(farmId, CAT_TREATMENTS, key);
  }

  public List<VaccinationProgramDto> listVaccinationPrograms() {
    return parametersFacade.listPlatform(CAT_PROGRAMS).stream()
        .map(HealthCatalogService::toProgram)
        .toList();
  }

  /** Standard programs applicable to a breed (its {@code breed_keys} contains {@code breedKey}). */
  public List<VaccinationProgramDto> getVaccinationProgramsForBreed(String breedKey) {
    return listVaccinationPrograms().stream()
        .filter(p -> p.breedKeys().contains(breedKey))
        .toList();
  }

  /** A single program by key (404 if unknown), with its schedule deserialized. */
  public VaccinationProgramDto resolveProgramByKey(String key) {
    return parametersFacade.listPlatform(CAT_PROGRAMS).stream()
        .filter(e -> e.key().equals(key))
        .map(HealthCatalogService::toProgram)
        .findFirst()
        .orElseThrow(
            () -> new NotFoundException("VACCINATION_PROGRAM_NOT_FOUND", "Unknown program " + key));
  }

  // --- mappers (catalog JSON -> DTO) ----------------------------------

  private static VaccineDto toVaccine(CatalogEntryInfo e) {
    Map<String, Object> v = e.value();
    return new VaccineDto(
        e.key(),
        str(v, "label"),
        str(v, "disease"),
        str(v, "route"),
        bool(v, "active_strain"),
        str(v, "usage"),
        str(v, "wave"),
        e.custom());
  }

  private static TreatmentDto toTreatment(CatalogEntryInfo e) {
    Map<String, Object> v = e.value();
    return new TreatmentDto(
        e.key(),
        str(v, "label"),
        str(v, "molecule"),
        str(v, "class"),
        intg(v, "withdrawal_days_meat"),
        intg(v, "withdrawal_days_eggs"),
        strList(v, "routes"),
        str(v, "wave"),
        e.custom());
  }

  private static VaccinationProgramDto toProgram(CatalogEntryInfo e) {
    Map<String, Object> v = e.value();
    List<VaccinationScheduleEntryDto> schedule = new ArrayList<>();
    Object raw = v.get("schedule");
    if (raw instanceof List<?> entries) {
      for (Object o : entries) {
        if (o instanceof Map<?, ?> entry) {
          @SuppressWarnings("unchecked")
          Map<String, Object> m = (Map<String, Object>) entry;
          Object ageObj = m.get("age");
          int ageValue = 0;
          String ageUnit = null;
          if (ageObj instanceof Map<?, ?> age) {
            @SuppressWarnings("unchecked")
            Map<String, Object> am = (Map<String, Object>) age;
            Integer val = intg(am, "value");
            ageValue = val != null ? val : 0;
            ageUnit = str(am, "unit");
          }
          schedule.add(
              new VaccinationScheduleEntryDto(
                  ageValue, ageUnit, str(m, "vaccine_key"), str(m, "route"), bool(m, "mandatory")));
        }
      }
    }
    return new VaccinationProgramDto(
        e.key(), str(v, "label"), str(v, "species"), strList(v, "breed_keys"), schedule);
  }

  // --- value coercions (JSONB -> Java) --------------------------------

  private static String str(Map<String, Object> v, String key) {
    Object o = v.get(key);
    return o != null ? o.toString() : null;
  }

  private static boolean bool(Map<String, Object> v, String key) {
    return Boolean.TRUE.equals(v.get(key));
  }

  private static Integer intg(Map<String, Object> v, String key) {
    return v.get(key) instanceof Number n ? n.intValue() : null;
  }

  private static List<String> strList(Map<String, Object> v, String key) {
    return v.get(key) instanceof List<?> l ? l.stream().map(Object::toString).toList() : List.of();
  }
}
