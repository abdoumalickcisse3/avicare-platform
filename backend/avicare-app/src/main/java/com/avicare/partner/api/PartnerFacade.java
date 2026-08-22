package com.avicare.partner.api;

import com.avicare.partner.api.dto.PartnerLink;
import java.util.List;
import java.util.Set;

/**
 * Public read contract of the partner context for other bounded contexts and future surfaces
 * (farmer app, partner portal). Scope filtering is the trust boundary: {@link #sharedScopes}
 * returns only what a farm has agreed to share with a given partner.
 */
public interface PartnerFacade {

  /** Confirmed farm ids in a partner's network. */
  List<Long> farmIdsInNetwork(Long partnerId);

  /** Scope keys a farm shares with a partner (empty if no active membership). */
  Set<String> sharedScopes(Long partnerId, Long farmId);

  /** A farm's non-LEFT partner links. */
  List<PartnerLink> partnersForFarm(Long farmId);
}
