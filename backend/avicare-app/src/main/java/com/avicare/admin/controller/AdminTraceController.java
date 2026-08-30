package com.avicare.admin.controller;

import com.avicare.admin.dto.response.RequestTraceDetail;
import com.avicare.admin.dto.response.RequestTraceRow;
import com.avicare.admin.service.AdminTraceReadService;
import com.avicare.common.api.response.ApiResponse;
import com.avicare.common.api.response.PageResponse;
import java.time.LocalDateTime;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Trace explorer for the back-office (chantier P1), behind the existing {@code metrics:read}: this
 * is platform observability, the same right as the cockpit, and it deserves no new permission.
 *
 * <p>The whole point is the first parameter: a user reports an error, reads out the identifier the
 * app showed them, and the request is found — payload, timing and stack trace included.
 */
@RestController
@RequestMapping("/api/v1/admin/traces")
@RequiredArgsConstructor
public class AdminTraceController {

  private static final int MAX_PAGE_SIZE = 100;

  private final AdminTraceReadService traceService;

  @GetMapping
  @PreAuthorize("@adminAccess.can('metrics:read')")
  public PageResponse<RequestTraceRow> search(
      @RequestParam(required = false) String requestId,
      @RequestParam(required = false) String email,
      @RequestParam(required = false) Long farmId,
      @RequestParam(required = false) String path,
      @RequestParam(required = false) Integer status,
      @RequestParam(defaultValue = "false") boolean errorsOnly,
      @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME)
          LocalDateTime from,
      @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME)
          LocalDateTime to,
      @RequestParam(defaultValue = "0") int page,
      @RequestParam(defaultValue = "25") int size) {
    return PageResponse.from(
        traceService.search(
            requestId,
            email,
            farmId,
            path,
            status,
            errorsOnly,
            from,
            to,
            PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), MAX_PAGE_SIZE))));
  }

  @GetMapping("/{id}")
  @PreAuthorize("@adminAccess.can('metrics:read')")
  public ApiResponse<RequestTraceDetail> detail(@PathVariable Long id) {
    return ApiResponse.of(traceService.detail(id));
  }
}
