package com.avicare.tenancy.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.avicare.common.security.principal.FarmRole;
import com.avicare.common.security.principal.UserRole;
import com.avicare.identity.api.dto.UserInfo;
import com.avicare.notification.api.WhatsAppOutboxFacade;
import com.avicare.tenancy.domain.Farm;
import com.avicare.tenancy.repository.FarmRepository;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

/** Ce que reçoit — et ne reçoit pas — la personne qu'on vient d'ajouter à une ferme. */
class MemberNotifierTest {

  private WhatsAppOutboxFacade whatsApp;
  private FarmRepository farmRepository;
  private MemberNotifier notifier;

  private static final UserInfo USER =
      new UserInfo(5L, "a@b.io", "Awa Diop", "+221771842787", UserRole.USER, true);

  @BeforeEach
  void setUp() {
    whatsApp = mock(WhatsAppOutboxFacade.class);
    farmRepository = mock(FarmRepository.class);
    notifier = new MemberNotifier(whatsApp, farmRepository);

    Farm farm = new Farm();
    farm.setName("Ferme Keur Massar");
    when(farmRepository.findById(7L)).thenReturn(Optional.of(farm));
  }

  private String captureMessage() {
    ArgumentCaptor<String> message = ArgumentCaptor.forClass(String.class);
    verify(whatsApp).enqueue(anyString(), message.capture());
    return message.getValue();
  }

  @Test
  void attachedAccount_saysTheyKeepTheirOwnPassword() {
    notifier.memberAdded(7L, USER, FarmRole.MANAGER, false);

    String message = captureMessage();
    assertThat(message).startsWith("Ferme Keur Massar");
    assertThat(message).contains("gestionnaire");
    assertThat(message).contains("mot de passe habituel");
  }

  @Test
  void createdAccount_neverCarriesThePasswordItself() {
    // Un code de réinitialisation expire en quinze minutes ; un mot de passe provisoire resterait
    // lisible dans la conversation pour toujours. Le message annonce l'accès, pas le secret.
    notifier.memberAdded(7L, USER, FarmRole.FARMER, true);

    String message = captureMessage();
    assertThat(message).startsWith("Ferme Keur Massar");
    assertThat(message).contains("éleveur");
    assertThat(message).contains("provisoire");
    assertThat(message).doesNotContain("mot de passe habituel");
  }

  @Test
  void namesTheFarmFirst_orSendsNothing() {
    // Un message qui ne dit pas de qui il vient est un numéro inconnu qui réclame quelque chose.
    when(farmRepository.findById(7L)).thenReturn(Optional.empty());

    notifier.memberAdded(7L, USER, FarmRole.MANAGER, false);

    verify(whatsApp, never()).enqueue(anyString(), anyString());
  }

  @Test
  void staysSilentWithoutANumber() {
    UserInfo noPhone = new UserInfo(5L, "a@b.io", "Awa Diop", null, UserRole.USER, true);

    notifier.memberAdded(7L, noPhone, FarmRole.MANAGER, false);

    verify(whatsApp, never()).enqueue(anyString(), anyString());
  }

  @Test
  void writesToTheAccountNumber_notTheOneTheOwnerTyped() {
    // L'appelant passe le UserInfo du compte : si le propriétaire s'est trompé d'un chiffre en
    // saisissant le numéro d'un collègue déjà inscrit, c'est la ligne du compte qui fait foi.
    notifier.memberAdded(7L, USER, FarmRole.MANAGER, false);

    ArgumentCaptor<String> phone = ArgumentCaptor.forClass(String.class);
    verify(whatsApp).enqueue(phone.capture(), any());
    assertThat(phone.getValue()).isEqualTo("+221771842787");
  }
}
