package com.avicare.admin.dto.response;

import java.time.LocalDateTime;
import java.util.List;

/**
 * The 360° view of one farm for support: identity, who is on it, what it has enabled, how much it
 * produces, and which partner networks it belongs to.
 *
 * <p>Assembled entirely from public facades — the back-office never reads another context's
 * entities.
 */
public record AdminFarmDetail(
    Long farmId,
    String name,
    String currency,
    String timezone,
    boolean active,
    long memberCount,
    long activeUnitCount,
    long totalHeadcount,
    LocalDateTime lastActivityAt,
    List<String> enabledModules,
    List<PartnerLinkRow> partners) {

  /** A partner network this farm belongs to, as seen from the console. */
  public record PartnerLinkRow(Long partnerId, String partnerName, String type, String status) {}
}
