package com.avicare.livestock.commercial;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatExceptionOfType;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

import com.avicare.common.api.exception.NotFoundException;
import com.avicare.common.api.exception.ValidationException;
import com.avicare.livestock.domain.Client;
import com.avicare.livestock.domain.ClientType;
import com.avicare.livestock.repository.ClientRepository;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

/**
 * Unit test for {@link ClientService} — directory CRUD + indicative credit logic (D26), all
 * collaborators mocked. Runs in surefire/CI (no Docker).
 */
class ClientServiceTest {

  private ClientRepository clientRepository;
  private ClientService service;

  @BeforeEach
  void setUp() {
    clientRepository = Mockito.mock(ClientRepository.class);
    service = new ClientService(clientRepository);
    when(clientRepository.save(any(Client.class))).thenAnswer(inv -> inv.getArgument(0));
  }

  private static ClientCommand command() {
    return new ClientCommand(
        ClientType.BUSINESS,
        "Ferme du Soleil",
        "Soleil SARL",
        "+221770000000",
        "soleil@example.com",
        "Route de Rufisque",
        "Dakar",
        500_000L,
        "30 jours",
        "VIP");
  }

  @Test
  void create_persistsAFarmScopedActiveClientWithZeroBalance() {
    Client saved = service.create(7L, command(), 42L);

    assertThat(saved.getFarmId()).isEqualTo(7L);
    assertThat(saved.getClientType()).isEqualTo(ClientType.BUSINESS);
    assertThat(saved.getDisplayName()).isEqualTo("Ferme du Soleil");
    assertThat(saved.getLegalName()).isEqualTo("Soleil SARL");
    assertThat(saved.getCreditLimitXof()).isEqualTo(500_000L);
    assertThat(saved.getCurrentBalanceXof()).isZero();
    assertThat(saved.isActive()).isTrue();
    assertThat(saved.getCreatedBy()).isEqualTo(42L);
  }

  @Test
  void create_rejectsBlankDisplayName() {
    ClientCommand cmd =
        new ClientCommand(
            ClientType.INDIVIDUAL, "  ", null, null, null, null, null, null, null, null);

    assertThatExceptionOfType(ValidationException.class)
        .isThrownBy(() -> service.create(7L, cmd, 42L));
  }

  @Test
  void create_rejectsNullClientType() {
    ClientCommand cmd =
        new ClientCommand(null, "Sans type", null, null, null, null, null, null, null, null);

    assertThatExceptionOfType(ValidationException.class)
        .isThrownBy(() -> service.create(7L, cmd, 42L));
  }

  @Test
  void update_appliesEditableFields() {
    Client existing = newClient(7L, 3L, ClientType.INDIVIDUAL, 100_000L, 0L);
    when(clientRepository.findByFarmIdAndId(7L, 3L)).thenReturn(Optional.of(existing));

    Client updated = service.update(7L, 3L, command());

    assertThat(updated.getClientType()).isEqualTo(ClientType.BUSINESS);
    assertThat(updated.getDisplayName()).isEqualTo("Ferme du Soleil");
    assertThat(updated.getCreditLimitXof()).isEqualTo(500_000L);
  }

  @Test
  void update_unknownClientThrowsNotFound() {
    when(clientRepository.findByFarmIdAndId(7L, 99L)).thenReturn(Optional.empty());

    assertThatExceptionOfType(NotFoundException.class)
        .isThrownBy(() -> service.update(7L, 99L, command()));
  }

  @Test
  void deactivate_softDeletesTheClient() {
    Client existing = newClient(7L, 3L, ClientType.INDIVIDUAL, null, 0L);
    when(clientRepository.findByFarmIdAndId(7L, 3L)).thenReturn(Optional.of(existing));

    service.deactivate(7L, 3L);

    assertThat(existing.isActive()).isFalse();
  }

  @Test
  void adjustBalance_addsDeltaToReceivable() {
    Client existing = newClient(7L, 3L, ClientType.BUSINESS, 500_000L, 100_000L);
    when(clientRepository.findByFarmIdAndId(7L, 3L)).thenReturn(Optional.of(existing));

    Client afterCharge = service.adjustBalance(7L, 3L, 50_000L);
    assertThat(afterCharge.getCurrentBalanceXof()).isEqualTo(150_000L);

    Client afterPayment = service.adjustBalance(7L, 3L, -200_000L);
    assertThat(afterPayment.getCurrentBalanceXof()).isEqualTo(-50_000L);
  }

  @Test
  void projectCredit_noLimitIsNeverOverLimit() {
    Client existing = newClient(7L, 3L, ClientType.BUSINESS, null, 9_000_000L);
    when(clientRepository.findByFarmIdAndId(7L, 3L)).thenReturn(Optional.of(existing));

    CreditStatus status = service.projectCredit(7L, 3L, 1_000_000L);

    assertThat(status.overLimit()).isFalse();
    assertThat(status.creditLimitXof()).isNull();
    assertThat(status.overLimitPercent()).isNull();
    assertThat(status.projectedBalanceXof()).isEqualTo(10_000_000L);
  }

  @Test
  void projectCredit_underLimitIsNotOverLimit() {
    Client existing = newClient(7L, 3L, ClientType.BUSINESS, 500_000L, 100_000L);
    when(clientRepository.findByFarmIdAndId(7L, 3L)).thenReturn(Optional.of(existing));

    CreditStatus status = service.projectCredit(7L, 3L, 300_000L);

    assertThat(status.overLimit()).isFalse();
    assertThat(status.projectedBalanceXof()).isEqualTo(400_000L);
    assertThat(status.overLimitPercent()).isEqualTo(80);
  }

  @Test
  void projectCredit_overLimitFlagsAndComputesPercent() {
    Client existing = newClient(7L, 3L, ClientType.BUSINESS, 500_000L, 400_000L);
    when(clientRepository.findByFarmIdAndId(7L, 3L)).thenReturn(Optional.of(existing));

    CreditStatus status = service.projectCredit(7L, 3L, 350_000L);

    assertThat(status.overLimit()).isTrue();
    assertThat(status.projectedBalanceXof()).isEqualTo(750_000L);
    assertThat(status.overLimitPercent()).isEqualTo(150);
  }

  @Test
  void listOverCreditLimit_delegatesToRepository() {
    Client over = newClient(7L, 3L, ClientType.BUSINESS, 100_000L, 200_000L);
    when(clientRepository.findOverCreditLimit(7L)).thenReturn(List.of(over));

    assertThat(service.listOverCreditLimit(7L)).containsExactly(over);
  }

  private static Client newClient(
      Long farmId, Long id, ClientType type, Long creditLimit, long balance) {
    Client c = new Client();
    c.setId(id);
    c.setFarmId(farmId);
    c.setClientType(type);
    c.setDisplayName("Existing");
    c.setCreditLimitXof(creditLimit);
    c.setCurrentBalanceXof(balance);
    c.setActive(true);
    return c;
  }
}
