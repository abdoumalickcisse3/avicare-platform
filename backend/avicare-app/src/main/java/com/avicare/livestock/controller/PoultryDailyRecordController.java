package com.avicare.livestock.controller;

import com.avicare.common.api.response.ApiResponse;
import com.avicare.common.tenancy.context.TenancyContext;
import com.avicare.livestock.domain.DailyRecord;
import com.avicare.livestock.dto.request.DailyRecordRequest;
import com.avicare.livestock.dto.response.DailyRecordResponse;
import com.avicare.livestock.poultry.DailyRecordCommand;
import com.avicare.livestock.poultry.DailyRecordService;
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
 * Daily record endpoints for a broiler batch (Sprint B1-3). Same farm-access + feature gate as
 * {@link PoultryBatchController}; recording (upsert) needs an operational role.
 */
@RestController
@RequestMapping("/api/v1/farms/{farmId}/poultry-batches/{batchId}/daily-records")
@RequiredArgsConstructor
public class PoultryDailyRecordController {

  private final DailyRecordService dailyRecordService;

  @GetMapping
  @PreAuthorize(PoultryBatchController.READ)
  public ApiResponse<List<DailyRecordResponse>> list(
      @PathVariable Long farmId, @PathVariable Long batchId) {
    return ApiResponse.of(
        dailyRecordService.listForUnit(batchId).stream()
            .map(PoultryDailyRecordController::toResponse)
            .toList());
  }

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  @PreAuthorize(PoultryBatchController.WRITE)
  public ApiResponse<DailyRecordResponse> record(
      @PathVariable Long farmId,
      @PathVariable Long batchId,
      @RequestBody @Valid DailyRecordRequest request) {
    DailyRecord saved =
        dailyRecordService.record(
            batchId,
            new DailyRecordCommand(
                request.recordDate(),
                request.mortalityCount(),
                request.feedKg(),
                request.waterL(),
                request.observations(),
                null),
            TenancyContext.currentUserId());
    return ApiResponse.of(toResponse(saved));
  }

  static DailyRecordResponse toResponse(DailyRecord d) {
    return new DailyRecordResponse(
        d.getId(),
        d.getProductionUnit().getId(),
        d.getRecordDate(),
        d.getMortalityCount(),
        d.getFeedKg(),
        d.getWaterL(),
        d.getObservations());
  }
}
