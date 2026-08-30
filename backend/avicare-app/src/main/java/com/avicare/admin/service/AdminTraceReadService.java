package com.avicare.admin.service;

import com.avicare.admin.domain.AdminAuditLog;
import com.avicare.admin.domain.RequestTrace;
import com.avicare.admin.dto.response.RequestTraceDetail;
import com.avicare.admin.dto.response.RequestTraceRow;
import com.avicare.admin.repository.AdminAuditLogRepository;
import com.avicare.admin.repository.RequestTraceRepository;
import com.avicare.common.api.exception.NotFoundException;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Reads for the console trace explorer ({@code /console/traces}).
 *
 * <p>The list stays deliberately payload-free: scanning traces is routine, and routine reads should
 * not stream farmers' data through the back-office. Opening one trace does show its payload — and
 * because that is a disclosure, it is written to the audit trail like any sensitive staff action.
 */
@Service
@RequiredArgsConstructor
public class AdminTraceReadService {

  private final RequestTraceRepository traceRepository;
  private final AdminAuditLogRepository auditLogRepository;
  private final AdminAuditService auditService;

  @Transactional(readOnly = true)
  public Page<RequestTraceRow> search(
      String requestId,
      String email,
      Long farmId,
      String path,
      Integer status,
      boolean errorsOnly,
      LocalDateTime from,
      LocalDateTime to,
      Pageable pageable) {
    return traceRepository
        .search(
            blankToNull(requestId),
            blankToNull(email),
            farmId,
            blankToNull(path),
            status,
            errorsOnly,
            from,
            to,
            pageable)
        .map(AdminTraceReadService::toRow);
  }

  /**
   * One trace with its payloads. Audited: {@code trace.view} names the staff member, the trace and
   * the farm whose data was displayed.
   */
  @Transactional(readOnly = true)
  public RequestTraceDetail detail(Long id) {
    RequestTrace trace =
        traceRepository.findById(id).orElseThrow(() -> NotFoundException.of("RequestTrace", id));

    auditService.record(
        "trace.view",
        "RequestTrace",
        trace.getId(),
        trace.getFarmId(),
        Map.of("requestId", trace.getRequestId(), "path", trace.getPath()));

    List<String> auditActions =
        auditLogRepository.findByRequestIdOrderByCreatedAtAsc(trace.getRequestId()).stream()
            .map(AdminAuditLog::getAction)
            .filter(action -> !"trace.view".equals(action))
            .toList();

    return new RequestTraceDetail(
        trace.getId(),
        trace.getRequestId(),
        trace.getMethod(),
        trace.getPath(),
        trace.getRoutePattern(),
        trace.getStatusCode(),
        trace.getDurationMs(),
        trace.getUserId(),
        trace.getUserEmail(),
        trace.getFarmId(),
        trace.getIp(),
        trace.getRequestBody(),
        trace.getResponseBody(),
        trace.getErrorMessage(),
        trace.getStackTrace(),
        trace.getStartedAt(),
        trace.getEndedAt(),
        auditActions);
  }

  private static RequestTraceRow toRow(RequestTrace trace) {
    return new RequestTraceRow(
        trace.getId(),
        trace.getRequestId(),
        trace.getMethod(),
        trace.getPath(),
        trace.getStatusCode(),
        trace.getDurationMs(),
        trace.getUserEmail(),
        trace.getFarmId(),
        trace.getErrorMessage() != null
            || (trace.getStatusCode() != null && trace.getStatusCode() >= 400),
        trace.getStartedAt());
  }

  private static String blankToNull(String value) {
    return value == null || value.isBlank() ? null : value;
  }
}
