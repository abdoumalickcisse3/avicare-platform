package com.avicare.identity.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.avicare.identity.domain.PasswordResetCode;
import com.avicare.identity.domain.User;
import com.avicare.identity.repository.PasswordResetCodeRepository;
import com.avicare.identity.repository.UserRepository;
import com.avicare.notification.api.WhatsAppMessenger;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class PasswordResetServiceTest {

  private static final String PHONE = "770000001";

  @Mock UserRepository userRepository;
  @Mock PasswordResetCodeRepository codeRepository;
  @Mock WhatsAppMessenger whatsAppMessenger;
  @Mock RefreshTokenService refreshTokenService;

  // A real encoder at low cost: the point of these tests is the hashing contract.
  private final PasswordEncoder encoder = new BCryptPasswordEncoder(4);

  private PasswordResetService service() {
    return new PasswordResetService(
        userRepository, codeRepository, encoder, whatsAppMessenger, refreshTokenService);
  }

  private User user(String phone, boolean active) {
    User u = new User();
    u.setId(7L);
    u.setEmail("f@test.io");
    u.setPhone(phone);
    u.setPasswordHash("old-hash");
    u.setActive(active);
    return u;
  }

  private void accountsMatching(User... users) {
    when(userRepository.findByPhoneDigits(anyString())).thenReturn(List.of(users));
  }

  private String sentCode() {
    ArgumentCaptor<String> message = ArgumentCaptor.captor();
    verify(whatsAppMessenger).sendNow(anyString(), message.capture());
    var matcher = java.util.regex.Pattern.compile("(\\d{6})").matcher(message.getValue());
    assertThat(matcher.find()).isTrue();
    return matcher.group(1);
  }

  private PasswordResetCode storedCode() {
    ArgumentCaptor<PasswordResetCode> saved = ArgumentCaptor.captor();
    verify(codeRepository).save(saved.capture());
    return saved.getValue();
  }

  @Test
  void sendsASixDigitCodeAndStoresOnlyItsHash() {
    accountsMatching(user(PHONE, true));

    service().requestCode("+221 77 000 00 01");

    String code = sentCode();
    assertThat(code).hasSize(6);
    PasswordResetCode stored = storedCode();
    // A leak of this table must not hand out working codes.
    assertThat(stored.getCodeHash()).isNotEqualTo(code).startsWith("$2");
    assertThat(encoder.matches(code, stored.getCodeHash())).isTrue();
  }

  @Test
  void staysSilentForAnUnknownNumber() {
    accountsMatching();

    // Answering differently would turn the endpoint into a directory of who is registered.
    assertThatCode(() -> service().requestCode(PHONE)).doesNotThrowAnyException();
    verify(whatsAppMessenger, never()).sendNow(anyString(), anyString());
    verify(codeRepository, never()).save(any());
  }

  @Test
  void staysSilentWhenSeveralAccountsShareTheNumber() {
    // The phone column has no uniqueness constraint; sending here would hand one person a way
    // into someone else's account.
    accountsMatching(user(PHONE, true), user(PHONE, true));

    service().requestCode(PHONE);

    verify(whatsAppMessenger, never()).sendNow(anyString(), anyString());
  }

  @Test
  void staysSilentForADisabledAccount() {
    accountsMatching(user(PHONE, false));

    service().requestCode(PHONE);

    verify(whatsAppMessenger, never()).sendNow(anyString(), anyString());
  }

  @Test
  void throttlesASecondRequestWithinTheMinute() {
    accountsMatching(user(PHONE, true));
    PasswordResetCode recent = new PasswordResetCode();
    ReflectionTestUtils.setField(recent, "createdAt", LocalDateTime.now().minusSeconds(10));
    when(codeRepository.findFirstByUserIdOrderByCreatedAtDesc(7L)).thenReturn(Optional.of(recent));

    service().requestCode(PHONE);

    // Otherwise the endpoint is a way to flood someone's WhatsApp at the platform's expense.
    verify(whatsAppMessenger, never()).sendNow(anyString(), anyString());
  }

  @Test
  void matchesTheNumberOnDigitsWhateverTheFormat() {
    accountsMatching(user(PHONE, true));

    service().requestCode("+221 77-000-00-01");

    ArgumentCaptor<String> digits = ArgumentCaptor.captor();
    verify(userRepository).findByPhoneDigits(digits.capture());
    assertThat(digits.getValue()).isEqualTo("221770000001");
  }

  private PasswordResetCode liveCode(String rawCode) {
    PasswordResetCode entry = new PasswordResetCode();
    entry.setUserId(7L);
    entry.setCodeHash(encoder.encode(rawCode));
    entry.setExpiresAt(LocalDateTime.now().plusMinutes(10));
    return entry;
  }

  @Test
  void setsTheNewPasswordAndRevokesEverySession() {
    User user = user(PHONE, true);
    accountsMatching(user);
    when(codeRepository.findFirstByUserIdOrderByCreatedAtDesc(7L))
        .thenReturn(Optional.of(liveCode("123456")));

    service().confirm(PHONE, "123456", "NouveauMotDePasse1");

    assertThat(encoder.matches("NouveauMotDePasse1", user.getPasswordHash())).isTrue();
    // Whoever knew the old password — possibly whoever prompted this reset — loses their session.
    verify(refreshTokenService).revokeAllForUser(7L);
  }

  @Test
  void burnsAnAttemptOnAWrongCode() {
    accountsMatching(user(PHONE, true));
    PasswordResetCode entry = liveCode("123456");
    when(codeRepository.findFirstByUserIdOrderByCreatedAtDesc(7L)).thenReturn(Optional.of(entry));

    assertThatThrownBy(() -> service().confirm(PHONE, "000000", "NouveauMotDePasse1"))
        .isInstanceOf(PasswordResetService.InvalidResetCodeException.class);

    // Six digits is a million combinations: without a budget, an online brute force wins.
    assertThat(entry.getAttempts()).isEqualTo(1);
    verify(codeRepository).save(entry);
  }

  @Test
  void refusesAnExhaustedCode() {
    accountsMatching(user(PHONE, true));
    PasswordResetCode entry = liveCode("123456");
    entry.setAttempts(PasswordResetService.MAX_ATTEMPTS);
    when(codeRepository.findFirstByUserIdOrderByCreatedAtDesc(7L)).thenReturn(Optional.of(entry));

    // Even the right code must not work once the budget is spent.
    assertThatThrownBy(() -> service().confirm(PHONE, "123456", "NouveauMotDePasse1"))
        .isInstanceOf(PasswordResetService.InvalidResetCodeException.class);
    verify(refreshTokenService, never()).revokeAllForUser(anyLong());
  }

  @Test
  void refusesAnExpiredOrAlreadyUsedCode() {
    accountsMatching(user(PHONE, true));

    PasswordResetCode expired = liveCode("123456");
    expired.setExpiresAt(LocalDateTime.now().minusMinutes(1));
    when(codeRepository.findFirstByUserIdOrderByCreatedAtDesc(7L)).thenReturn(Optional.of(expired));
    assertThatThrownBy(() -> service().confirm(PHONE, "123456", "NouveauMotDePasse1"))
        .isInstanceOf(PasswordResetService.InvalidResetCodeException.class);

    PasswordResetCode consumed = liveCode("123456");
    consumed.setConsumedAt(LocalDateTime.now());
    when(codeRepository.findFirstByUserIdOrderByCreatedAtDesc(7L))
        .thenReturn(Optional.of(consumed));
    assertThatThrownBy(() -> service().confirm(PHONE, "123456", "NouveauMotDePasse1"))
        .isInstanceOf(PasswordResetService.InvalidResetCodeException.class);
  }

  @Test
  void reportsTheSameFailureForAnUnknownNumberAsForAWrongCode() {
    accountsMatching();

    // A different message here would say whether the number is registered.
    assertThatThrownBy(() -> service().confirm(PHONE, "123456", "NouveauMotDePasse1"))
        .isInstanceOf(PasswordResetService.InvalidResetCodeException.class)
        .hasMessageContaining("invalide");
  }
}
