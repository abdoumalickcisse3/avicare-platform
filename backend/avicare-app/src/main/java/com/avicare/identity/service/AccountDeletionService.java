package com.avicare.identity.service;

import com.avicare.common.api.exception.BusinessRuleException;
import com.avicare.common.api.exception.ForbiddenException;
import com.avicare.common.api.exception.NotFoundException;
import com.avicare.common.security.principal.UserRole;
import com.avicare.identity.api.IdentityFacade;
import com.avicare.identity.domain.User;
import com.avicare.identity.repository.UserRepository;
import com.avicare.tenancy.api.TenancyFacade;
import java.util.List;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Closing one's own account, from inside the app.
 *
 * <p>Apple's App Store rule 5.1.1(v) requires any app that lets someone create an account to let
 * them delete it <b>from the app</b> — not by email, not through support. The platform already had
 * erasure, but only on the admin console ({@code ComplianceService}), which an account holder
 * cannot reach. That console path also refuses self-anonymisation on purpose, so this is a separate
 * road to the same destination rather than a reuse of it.
 *
 * <h2>What disappears</h2>
 *
 * <p>The account is <b>anonymised</b>, never row-deleted: {@code users(id)} is referenced by 59
 * columns, 45 of them without an {@code ON DELETE} clause, so deleting the row would simply fail
 * for anyone who has ever recorded anything. Anonymising keeps the history true — who did what —
 * while the person behind it stops being identifiable.
 *
 * <p>The farms they <b>own</b> are erased outright, with everything that cascades from them:
 * flocks, sales, invoices, expenses, and the other members' access. That is a deliberate product
 * decision, and a heavy one — it destroys work that belongs to other people and removes invoices
 * that may be wanted for accounting. The screen offering this must name what goes, in full, before
 * asking.
 *
 * <p>Farms where the person is only a manager, a field worker or a vet are left untouched: they
 * were never theirs. Their membership simply stops working, since the account no longer
 * authenticates.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class AccountDeletionService {

  private final UserRepository users;
  private final IdentityFacade identityFacade;
  private final TenancyFacade tenancyFacade;
  private final RefreshTokenService refreshTokenService;
  private final PasswordEncoder passwordEncoder;

  /** What deleting this account would destroy — shown before the confirmation, never after. */
  @Transactional(readOnly = true)
  public AccountDeletionPreview preview(Long userId) {
    return new AccountDeletionPreview(tenancyFacade.listOwnedFarmIds(userId).size());
  }

  /**
   * Erase the account and the farms it owns.
   *
   * @param rawPassword the account's own password, retyped. A session token is enough to browse; it
   *     is not enough to destroy. A phone left unlocked on a table is the ordinary case here, not
   *     the exotic one.
   */
  @Transactional
  public void deleteOwnAccount(Long userId, String rawPassword) {
    User user =
        users
            .findById(userId)
            .orElseThrow(() -> new NotFoundException("USER_NOT_FOUND", "User " + userId));

    if (!passwordEncoder.matches(rawPassword, user.getPasswordHash())) {
      throw new ForbiddenException(
          "ACCOUNT_DELETE_BAD_PASSWORD", "Mot de passe incorrect. Le compte n'a pas été supprimé.");
    }
    // Staff accounts carry console access, whose withdrawal is its own decision with its own
    // guards. Letting one be closed from the mobile app would slip past all of them.
    if (user.getRole() == UserRole.ADMIN) {
      throw new BusinessRuleException(
          "ACCOUNT_DELETE_STAFF",
          "Ce compte dispose d'un accès console. Contactez l'administrateur de la plateforme.");
    }

    List<Long> ownedFarms = tenancyFacade.listOwnedFarmIds(userId);
    for (Long farmId : ownedFarms) {
      tenancyFacade.purgeFarm(farmId);
    }

    identityFacade.anonymize(userId);
    refreshTokenService.revokeAllForUser(userId);

    // Logged at warn: irreversible, and the only trace left once the email is gone. The email
    // itself is deliberately absent — writing it here would defeat the anonymisation.
    log.warn("Account {} deleted on request, {} owned farm(s) purged", userId, ownedFarms.size());
  }

  /**
   * @param ownedFarmCount how many farms vanish with the account, members and history included.
   */
  public record AccountDeletionPreview(int ownedFarmCount) {}
}
