package com.avicare.livestock.inventory;

/**
 * Identifies the source action that triggered a stock consumption (Sprint B4-5). Exactly one of the
 * {@code *Id} backrefs is set; the orchestrator infers the movement reason from it and stamps it on
 * the resulting stock movement for traceability. {@code productionUnitId} is the lot the
 * consumption relates to (optional).
 */
public record ConsumptionSource(
    Long productionUnitId, Long dailyRecordId, Long vaccinationId, Long treatmentExecutedId) {

  public static ConsumptionSource dailyRecord(Long productionUnitId, Long dailyRecordId) {
    return new ConsumptionSource(productionUnitId, dailyRecordId, null, null);
  }

  public static ConsumptionSource vaccination(Long productionUnitId, Long vaccinationId) {
    return new ConsumptionSource(productionUnitId, null, vaccinationId, null);
  }

  public static ConsumptionSource treatment(Long productionUnitId, Long treatmentExecutedId) {
    return new ConsumptionSource(productionUnitId, null, null, treatmentExecutedId);
  }
}
