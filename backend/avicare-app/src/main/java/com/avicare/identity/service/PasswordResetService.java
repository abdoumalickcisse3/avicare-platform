package com.avicare.identity.service;

import com.avicare.common.api.exception.BusinessException;
import com.avicare.identity.domain.PasswordResetCode;
import com.avicare.identity.domain.User;
import com.avicare.identity.repository.PasswordResetCodeRepository;
import com.avicare.identity.repository.UserRepository;
import com.avicare.notification.api.WhatsAppMessenger;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Self-service password reset over WhatsApp.
 *
 * <p>WhatsApp rather than email because that is how the audience actually communicates, and because
 * no SMTP exists on the platform. Accounts without a phone number are not stranded: staff reset
 * them from the back-office console.
 *
 * <p>Four guards, each answering a specific attack:
 *
 * <ul>
 *   <li><b>Neutral response.</b> Requesting a code says the same thing whether the number is known
 *       or not — otherwise the endpoint becomes a public directory of who is registered.
 *   <li><b>Attempt budget.</b> Six digits is a million combinations; without a cap, an online brute
 *       force succeeds in minutes.
 *   <li><b>Short life.</b> Fifteen minutes, and single use.
 *   <li><b>Request throttle.</b> One code per minute per account, so the endpoint cannot be used to
 *       spam someone's WhatsApp at the platform's expense.
 * </ul>
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class PasswordResetService {

  static final int MAX_ATTEMPTS = 5;
  static final Duration CODE_TTL = Duration.ofMinutes(15);
  static final Duration MIN_INTERVAL = Duration.ofMinutes(1);
  private static final SecureRandom RANDOM = new SecureRandom();

  private final UserRepository userRepository;
  private final PasswordResetCodeRepository codeRepository;
  private final PasswordEncoder passwordEncoder;
  private final WhatsAppMessenger whatsAppMessenger;
  private final RefreshTokenService refreshTokenService;

  /**
   * Send a reset code to the account holding {@code rawPhone}, if there is exactly one.
   *
   * <p>Returns nothing on purpose: the caller must answer the same thing in every case.
   */
  @Transactional
  public void requestCode(String rawPhone) {
    Optional<User> match = uniqueUserByPhone(rawPhone);
    if (match.isEmpty()) {
      // Deliberately silent: telling the caller would answer "is this number registered?".
      log.info("Password reset requested for an unknown or ambiguous phone number");
      return;
    }
    User user = match.get();

    PasswordResetCode previous =
        codeRepository.findFirstByUserIdOrderByCreatedAtDesc(user.getId()).orElse(null);
    if (previous != null
        && previous.getCreatedAt() != null
        && previous.getCreatedAt().isAfter(LocalDateTime.now().minus(MIN_INTERVAL))) {
      // Throttled, and still silent — the answer must not depend on account state either.
      log.info("Password reset throttled for user {}", user.getId());
      return;
    }

    String code = newCode();
    PasswordResetCode entry = new PasswordResetCode();
    entry.setUserId(user.getId());
    entry.setCodeHash(passwordEncoder.encode(code));
    entry.setExpiresAt(LocalDateTime.now().plus(CODE_TTL));
    codeRepository.save(entry);

    whatsAppMessenger.sendNow(
        user.getPhone(),
        "Jawdi — code de réinitialisation : "
            + code
            + "\nValable "
            + CODE_TTL.toMinutes()
            + " minutes. Si vous n'avez rien demandé, ignorez ce message.");
  }

  /** Verify the code and set the new password. Every session of the account is then revoked. */
  @Transactional
  public void confirm(String rawPhone, String code, String newPassword) {
    User user = uniqueUserByPhone(rawPhone).orElseThrow(PasswordResetService::invalidCode);
    PasswordResetCode entry =
        codeRepository
            .findFirstByUserIdOrderByCreatedAtDesc(user.getId())
            .orElseThrow(PasswordResetService::invalidCode);

    if (!entry.isUsable(MAX_ATTEMPTS)) {
      throw invalidCode();
    }
    if (!passwordEncoder.matches(code, entry.getCodeHash())) {
      // Burn one attempt, and persist it even though we are about to throw.
      entry.setAttempts(entry.getAttempts() + 1);
      codeRepository.save(entry);
      throw invalidCode();
    }

    entry.setConsumedAt(LocalDateTime.now());
    codeRepository.save(entry);

    user.setPasswordHash(passwordEncoder.encode(newPassword));
    userRepository.save(user);
    // Whoever knew the old password — including whoever prompted this reset — loses their session.
    refreshTokenService.revokeAllForUser(user.getId());
    log.info("Password reset completed for user {}", user.getId());
  }

  /**
   * The single account holding this number, or empty. Empty when several match: the phone column
   * carries no uniqueness constraint, and sending a reset to an ambiguous number would hand one
   * person a way into someone else's account.
   */
  private Optional<User> uniqueUserByPhone(String rawPhone) {
    if (rawPhone == null || rawPhone.isBlank()) {
      return Optional.empty();
    }
    List<User> matches = userRepository.findByPhoneDigits(digitsOf(rawPhone));
    return matches.size() == 1 && matches.get(0).isActive()
        ? Optional.of(matches.get(0))
        : Optional.empty();
  }

  /** Compare on digits only: a farmer types their number the way they say it, not as stored. */
  static String digitsOf(String raw) {
    return raw == null ? "" : raw.replaceAll("\\D", "");
  }

  private static String newCode() {
    return String.format("%06d", RANDOM.nextInt(1_000_000));
  }

  private static InvalidResetCodeException invalidCode() {
    return new InvalidResetCodeException();
  }

  /** One message for every failure: wrong code, expired, consumed, unknown number. */
  public static class InvalidResetCodeException extends BusinessException {
    public InvalidResetCodeException() {
      super(
          "RESET_CODE_INVALID",
          "Code invalide ou expiré. Demandez un nouveau code.",
          HttpStatus.UNPROCESSABLE_ENTITY);
    }
  }
}
