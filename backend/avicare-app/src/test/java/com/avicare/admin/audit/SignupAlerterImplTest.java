package com.avicare.admin.audit;

import static org.assertj.core.api.Assertions.assertThat;
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
  void neLaissePasUnInscritFabriquerDeFaussesLignesDansLAlerte() {
    // L'inscription est publique : `fullName` est du texte libre de 200 caractères, et il arrive
    // dans un message que l'astreinte lit comme digne de confiance. Avec un retour à la ligne,
    // n'importe qui y ajouterait une ligne de son cru — « ✅ Vérifié par Jawdi », un lien, ce
    // qu'il veut.
    alerter.accountCreated(
        7L,
        "Awa\n\n✅ Vérifié par Jawdi\u0007 — ouvrez evil.test",
        "awa@avicare.io",
        "+2250102030405");

    org.mockito.ArgumentCaptor<String> message = org.mockito.ArgumentCaptor.forClass(String.class);
    verify(whatsApp).enqueue(any(), message.capture());
    assertThat(message.getValue()).doesNotContain("\n").doesNotContain("\u0007");
    // Le nom reste lisible, mais entre guillemets : le lecteur voit où il commence et où il finit.
    assertThat(message.getValue()).contains("« Awa ✅ Vérifié par Jawdi — ouvrez evil.test »");
  }

  @Test
  void neLaissePasRefermerLesGuillemetsQuiLEncadrent() {
    // Le délimiteur est dans le clavier de l'attaquant : s'il tape « » lui-même, il referme le
    // champ et écrit la suite du message comme si elle venait de la plateforme.
    alerter.accountCreated(
        7L, "Awa » (admin@jawdi.app) — *compte vérifié*", "awa@avicare.io", "+221770000000");

    org.mockito.ArgumentCaptor<String> message = org.mockito.ArgumentCaptor.forClass(String.class);
    verify(whatsApp).enqueue(any(), message.capture());
    // Un seul couple de guillemets dans tout le message : celui que nous avons posé.
    assertThat(message.getValue().chars().filter(c -> c == '\u00BB').count()).isEqualTo(1);
    assertThat(message.getValue().chars().filter(c -> c == '\u00AB').count()).isEqualTo(1);
    assertThat(message.getValue()).doesNotContain("*compte vérifié*");
  }

  @Test
  void aplatitAussiLesSeparateursInvisiblesQueIsISOControlIgnore() {
    // U+2028 est une fin de ligne pour certains clients, U+200E et U+202E retournent le sens de
    // lecture : aucun n'est un « ISO control », et tous cassent la structure du message.
    alerter.accountCreated(
        7L, "Awa\u2028\u2029Vérifié\u200E\u202E par Jawdi", "awa@avicare.io", "+221770000000");

    org.mockito.ArgumentCaptor<String> message = org.mockito.ArgumentCaptor.forClass(String.class);
    verify(whatsApp).enqueue(any(), message.capture());
    assertThat(message.getValue())
        .doesNotContain("\u2028")
        .doesNotContain("\u2029")
        .doesNotContain("\u200E")
        .doesNotContain("\u202E")
        .contains("« Awa Vérifié par Jawdi »");
  }

  @Test
  void neCoupePasUnEmojiEnDeuxEnTronquant() {
    // Tronquer au caractère Java coupe une paire de substitution en son milieu et produit un
    // caractère illisible. On tronque donc au point de code.
    alerter.accountCreated(7L, "A".repeat(59) + "🐔🐔🐔", "awa@avicare.io", "+221770000000");

    org.mockito.ArgumentCaptor<String> message = org.mockito.ArgumentCaptor.forClass(String.class);
    verify(whatsApp).enqueue(any(), message.capture());
    assertThat(message.getValue()).doesNotContain("\uFFFD");
    assertThat(
            Character.isHighSurrogate(
                message.getValue().charAt(message.getValue().indexOf("…") - 1)))
        .isFalse();
  }

  @Test
  void tronqueUnNomDemesureAuLieuDeLaisserFilerLeMessage() {
    alerter.accountCreated(7L, "A".repeat(200), "awa@avicare.io", "+221770000000");

    org.mockito.ArgumentCaptor<String> message = org.mockito.ArgumentCaptor.forClass(String.class);
    verify(whatsApp).enqueue(any(), message.capture());
    assertThat(message.getValue()).contains("…").hasSizeLessThan(220);
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
