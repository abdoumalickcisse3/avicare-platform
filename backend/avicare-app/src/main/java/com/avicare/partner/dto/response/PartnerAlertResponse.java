package com.avicare.partner.dto.response;

import com.avicare.partner.domain.PartnerAlert;
import java.time.LocalDateTime;

/**
 * One open network alert as shown in the partner portal. {@code title} and {@code body} are already
 * scope-safe French text (built by the scanner); the portal renders them as-is.
 */
public record PartnerAlertResponse(
    Long id,
    Long farmId,
    String category,
    String severity,
    String title,
    String body,
    LocalDateTime createdAt) {

  public static PartnerAlertResponse of(PartnerAlert a) {
    return new PartnerAlertResponse(
        a.getId(),
        a.getFarmId(),
        a.getCategory().name(),
        a.getSeverity().name(),
        a.getTitle(),
        a.getBody(),
        a.getCreatedAt());
  }
}
