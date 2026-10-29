package com.avicare.admin.audit;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

import com.avicare.admin.service.AdminAuditService;
import com.avicare.notification.api.WhatsAppOutboxFacade;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.test.util.ReflectionTestUtils;

/** Ce qu'une inscription raconte, et à qui. */
class SignupAlerterImplTest {

  private AdminAuditService auditService;
  private WhatsAppOutboxFacade whatsApp;
  private SignupAlerterImpl alerter;

  @BeforeEach
  void setUp() {
    auditService = Mockito.mock(AdminAuditService.class);
    whatsApp = Mockito.mock(WhatsAppOutboxFacade.class);
    alerter = new SignupAlerterImpl(auditService, whatsApp);
    ReflectionTestUtils.setField(alerter, "onCallPhone", "+221770000000");
  }

  @Test
  void ecritAuJournalEtMetEnFileUnWhatsApp() {
    alerter.accountCreated(7L, "Awa Diop", "awa@avicare.io", "+2250102030405");

    verify(auditService)
        .record(eq(7L), eq("signup.created"), eq("User"), eq(7L), isNull(), anyMap());
    verify(whatsApp).enqueue(eq("+221770000000"), contains("Awa Diop"));
  }

  @Test
  void porteLeNumeroDeLInscritPourQuOnPuisseLeRappeler() {
    alerter.accountCreated(7L, "Awa Diop", "awa@avicare.io", "+2250102030405");

    // L'indicatif dit le pays : c'est ce qui rend l'alerte lisible sans champ supplémentaire.
    verify(whatsApp).enqueue(any(), contains("+2250102030405"));
  }

  @Test
  void sansNumeroDAstreinteRienNEstEnvoyeMaisToutEstJournalise() {
    ReflectionTestUtils.setField(alerter, "onCallPhone", "");

    alerter.accountCreated(7L, "Awa Diop", "awa@avicare.io", "+2250102030405");

    // La trace vaut d'être gardée même quand personne n'est joignable.
    verify(auditService).record(anyLong(), any(), any(), any(), any(), anyMap());
    verifyNoInteractions(whatsApp);
  }
}
