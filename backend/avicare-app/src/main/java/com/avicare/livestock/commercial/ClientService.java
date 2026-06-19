package com.avicare.livestock.commercial;

import com.avicare.common.api.exception.NotFoundException;
import com.avicare.common.api.exception.ValidationException;
import com.avicare.livestock.domain.Client;
import com.avicare.livestock.repository.ClientRepository;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Per-farm client directory + indicative credit logic (Sprint B5-1). Clients are farm-scoped
 * (referenced by id, no cross-context association — ADR-008) and soft-deleted via {@code active}.
 *
 * <p>Credit (Décision D26) is purely informative and NEVER blocks: {@link #projectCredit} reports
 * whether a client's receivable (optionally plus a pending amount) exceeds their limit, but no
 * operation is refused on that basis. The receivable balance is moved only by {@link
 * #adjustBalance} (called by payment operations in B5-4), never by order operations. RBAC is
 * enforced at the controller layer (B5-5).
 */
@Service
@RequiredArgsConstructor
public class ClientService {

  private final ClientRepository clientRepository;

  @Transactional
  public Client create(Long farmId, ClientCommand cmd, Long userId) {
    requireValid(cmd);
    Client client = new Client();
    client.setFarmId(farmId);
    client.setCreatedBy(userId);
    client.setCurrentBalanceXof(0L);
    client.setActive(true);
    apply(client, cmd);
    return clientRepository.save(client);
  }

  @Transactional
  public Client update(Long farmId, Long clientId, ClientCommand cmd) {
    requireValid(cmd);
    Client client = load(farmId, clientId);
    apply(client, cmd);
    return client;
  }

  @Transactional
  public void deactivate(Long farmId, Long clientId) {
    load(farmId, clientId).setActive(false);
  }

  @Transactional(readOnly = true)
  public Client getById(Long farmId, Long clientId) {
    return load(farmId, clientId);
  }

  @Transactional(readOnly = true)
  public List<Client> listForFarm(Long farmId) {
    return clientRepository.findByFarmIdAndActiveTrueOrderByDisplayName(farmId);
  }

  /**
   * Move a client's receivable by {@code deltaXof} (positive = charge, negative = payment). The
   * balance may go negative when the client paid an advance.
   */
  @Transactional
  public Client adjustBalance(Long farmId, Long clientId, long deltaXof) {
    Client client = load(farmId, clientId);
    client.setCurrentBalanceXof(client.getCurrentBalanceXof() + deltaXof);
    return client;
  }

  /** Indicative credit snapshot, optionally adding a pending amount (D26 — never blocks). */
  @Transactional(readOnly = true)
  public CreditStatus projectCredit(Long farmId, Long clientId, long additionalXof) {
    Client client = load(farmId, clientId);
    long projected = client.getCurrentBalanceXof() + additionalXof;
    Long limit = client.getCreditLimitXof();
    if (limit == null) {
      return new CreditStatus(false, projected, null, null);
    }
    int percent = (int) Math.round((double) projected * 100 / limit);
    return new CreditStatus(projected > limit, projected, limit, percent);
  }

  @Transactional(readOnly = true)
  public List<Client> listOverCreditLimit(Long farmId) {
    return clientRepository.findOverCreditLimit(farmId);
  }

  // --- internals ------------------------------------------------------

  private Client load(Long farmId, Long clientId) {
    return clientRepository
        .findByFarmIdAndId(farmId, clientId)
        .orElseThrow(() -> NotFoundException.of("Client", clientId));
  }

  private static void requireValid(ClientCommand cmd) {
    if (cmd.clientType() == null) {
      throw new ValidationException("CLIENT_TYPE_REQUIRED", "Client type is required");
    }
    if (cmd.displayName() == null || cmd.displayName().isBlank()) {
      throw new ValidationException("CLIENT_NAME_REQUIRED", "Client display name is required");
    }
  }

  private static void apply(Client client, ClientCommand cmd) {
    client.setClientType(cmd.clientType());
    client.setDisplayName(cmd.displayName().strip());
    client.setLegalName(cmd.legalName());
    client.setPhone(cmd.phone());
    client.setEmail(cmd.email());
    client.setAddress(cmd.address());
    client.setCity(cmd.city());
    client.setCreditLimitXof(cmd.creditLimitXof());
    client.setDefaultPaymentTerms(cmd.defaultPaymentTerms());
    client.setNotes(cmd.notes());
  }
}
