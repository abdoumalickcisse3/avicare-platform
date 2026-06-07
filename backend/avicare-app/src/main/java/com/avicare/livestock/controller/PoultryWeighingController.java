package com.avicare.livestock.controller;

import com.avicare.common.api.response.ApiResponse;
import com.avicare.common.tenancy.context.TenancyContext;
import com.avicare.livestock.domain.GrowthPerformance;
import com.avicare.livestock.domain.WeighingSample;
import com.avicare.livestock.dto.request.WeighingRequest;
import com.avicare.livestock.dto.response.GrowthPerformanceResponse;
import com.avicare.livestock.dto.response.WeighingSampleResponse;
import com.avicare.livestock.poultry.GrowthAnalysisService;
import com.avicare.livestock.poultry.WeighingCommand;
import jakarta.validation.Valid;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * Sample weighings and the computed growth-performance snapshot for a broiler batch (Sprint B1-3).
 * Same farm-access + feature gate as {@link PoultryBatchController}; recording a weighing needs an
 * operational role.
 */
@RestController
@RequestMapping("/api/v1/farms/{farmId}/poultry-batches/{batchId}")
@RequiredArgsConstructor
public class PoultryWeighingController {

  private final GrowthAnalysisService growthAnalysisService;

  @GetMapping("/weighings")
  @PreAuthorize(PoultryBatchController.READ)
  public ApiResponse<List<WeighingSampleResponse>> listWeighings(
      @PathVariable Long farmId, @PathVariable Long batchId) {
    return ApiResponse.of(
        growthAnalysisService.listWeighings(batchId).stream()
            .map(PoultryWeighingController::toResponse)
            .toList());
  }

  @PostMapping("/weighings")
  @ResponseStatus(HttpStatus.CREATED)
  @PreAuthorize(PoultryBatchController.WRITE)
  public ApiResponse<WeighingSampleResponse> recordWeighing(
      @PathVariable Long farmId,
      @PathVariable Long batchId,
      @RequestBody @Valid WeighingRequest request) {
    WeighingSample saved =
        growthAnalysisService.recordWeighing(
            batchId,
            new WeighingCommand(request.sampleDate(), request.individualWeights(), request.notes()),
            TenancyContext.currentUserId());
    return ApiResponse.of(toResponse(saved));
  }

  @GetMapping("/performance")
  @PreAuthorize(PoultryBatchController.READ)
  public ApiResponse<GrowthPerformanceResponse> performance(
      @PathVariable Long farmId, @PathVariable Long batchId) {
    return ApiResponse.of(toResponse(growthAnalysisService.getLatestPerformance(batchId)));
  }

  static WeighingSampleResponse toResponse(WeighingSample w) {
    return new WeighingSampleResponse(
        w.getId(),
        w.getPoultryBatchId(),
        w.getSampleDate(),
        w.getAgeDays(),
        w.getSampleSize(),
        w.getAvgWeightG(),
        w.getMinWeightG(),
        w.getMaxWeightG(),
        w.getStdDeviation(),
        w.getUniformityPercent(),
        w.getNotes());
  }

  static GrowthPerformanceResponse toResponse(GrowthPerformance p) {
    return new GrowthPerformanceResponse(
        p.getPoultryBatchId(),
        p.getSnapshotDate(),
        p.getAgeDays(),
        p.getCurrentWeightG(),
        p.getGmqGPerDay(),
        p.getFeedConversionRatio(),
        p.getCumulativeMortalityPercent(),
        p.getCumulativeFeedKg(),
        p.getCumulativeWaterL(),
        p.getForecastedTargetDate(),
        p.getPerformanceScore());
  }
}
