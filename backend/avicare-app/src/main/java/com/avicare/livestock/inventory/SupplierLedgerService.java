package com.avicare.livestock.inventory;

import com.avicare.common.api.exception.BusinessRuleException;
import com.avicare.common.api.exception.NotFoundException;
import com.avicare.common.api.exception.ValidationException;
import com.avicare.livestock.domain.LedgerDirection;
import com.avicare.livestock.domain.LedgerSource;
import com.avicare.livestock.domain.Supplier;
import com.avicare.livestock.domain.SupplierLedgerEntry;
import com.avicare.livestock.repository.SupplierLedgerEntryRepository;
import com.avicare.livestock.repository.SupplierRepository;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Le compte-courant d'un fournisseur : ce que la ferme doit, ce qu'elle a versé, ce qui reste.
 *
 * <p>Ce service n'écrit JAMAIS de dépense. La charge d'un achat est enregistrée ailleurs — à la
 * réception du bon d'achat, ou à l'entrée du stock. C'est pourquoi il vit dans le contexte
 * livestock et n'importe rien de finance : la frontière de paquet tient la garantie, pas la
 * discipline.
 */
@Service
@RequiredArgsConstructor
public class SupplierLedgerService {

  private final SupplierLedgerEntryRepository ledgerRepository;
  private final SupplierRepository supplierRepository;
  private final SupplierNotifier supplierNotifier;

  @Transactional(readOnly = true)
  public long balance(Long farmId, Long supplierId) {
    requireSupplier(farmId, supplierId);
    return ledgerRepository.balanceFor(farmId, supplierId);
  }

  /**
   * Le solde de chaque fournisseur actif, ceux sans écriture compris — à zéro — plus tout
   * fournisseur désactivé dont le solde n'est pas nul.
   *
   * <p>Se retirer (passer {@code active} à {@code false}) n'efface pas ce qu'on lui doit encore :
   * une dette ne disparaît pas parce que la ferme a cessé d'acheter chez ce fournisseur. L'appel
   * supplémentaire ne va chercher que les fournisseurs désactivés qui ont réellement une écriture
   * au registre, jamais toute la table.
   */
  @Transactional(readOnly = true)
  public List<SupplierBalance> balances(Long farmId) {
    Map<Long, Long> bySupplier =
        ledgerRepository.balancesBySupplier(farmId).stream()
            .collect(Collectors.toMap(row -> (Long) row[0], row -> ((Number) row[1]).longValue()));

    List<Supplier> active =
        supplierRepository.findByFarmIdAndActiveTrueOrderByCommercialName(farmId);
    Set<Long> activeIds = active.stream().map(Supplier::getId).collect(Collectors.toSet());

    List<SupplierBalance> balances = new ArrayList<>();
    for (Supplier s : active) {
      balances.add(
          new SupplierBalance(
              s.getId(), s.getCommercialName(), bySupplier.getOrDefault(s.getId(), 0L)));
    }

    List<Long> inactiveWithBalance =
        bySupplier.entrySet().stream()
            .filter(e -> e.getValue() != 0L && !activeIds.contains(e.getKey()))
            .map(Map.Entry::getKey)
            .toList();
    if (!inactiveWithBalance.isEmpty()) {
      for (Supplier s : supplierRepository.findAllById(inactiveWithBalance)) {
        balances.add(
            new SupplierBalance(s.getId(), s.getCommercialName(), bySupplier.get(s.getId())));
      }
    }

    return balances;
  }

  @Transactional(readOnly = true)
  public List<SupplierStatementLine> statement(Long farmId, Long supplierId) {
    requireSupplier(farmId, supplierId);

    List<SupplierStatementLine> lines = new ArrayList<>();
    long running = 0;
    for (SupplierLedgerEntry e :
        ledgerRepository.findByFarmIdAndSupplierIdOrderByEntryDateAscIdAsc(farmId, supplierId)) {
      running += e.getDirection() == LedgerDirection.DEBIT ? e.getAmountXof() : -e.getAmountXof();
      lines.add(
          new SupplierStatementLine(
              e.getId(),
              e.getEntryDate(),
              e.getDirection(),
              e.getSource(),
              e.getAmountXof(),
              e.getLabel(),
              e.getMethod(),
              e.getReference(),
              e.getPurchaseOrderId(),
              running));
    }
    return lines;
  }

  @Transactional
  public SupplierLedgerEntry recordPayment(
      Long farmId, Long supplierId, SupplierLedgerCommand cmd, Long userId) {
    return recordManual(farmId, supplierId, cmd, LedgerDirection.CREDIT, userId);
  }

  @Transactional
  public SupplierLedgerEntry recordCharge(
      Long farmId, Long supplierId, SupplierLedgerCommand cmd, Long userId) {
    return recordManual(farmId, supplierId, cmd, LedgerDirection.DEBIT, userId);
  }

  /**
   * Le débit dérivé d'un bon d'achat reçu. Idempotent : appelé deux fois pour le même bon, il ne
   * fait rien la seconde. L'index unique de la base dit la même chose ; les deux se valent mieux
   * qu'un seul.
   *
   * <p>Ne revérifie PAS que {@code supplierId} appartient à {@code farmId} : contrairement aux
   * méthodes manuelles de cette classe, qui rechargent le fournisseur via {@link #requireSupplier},
   * celle-ci fait confiance à l'appelant pour l'avoir déjà chargé par un chemin scopé à la ferme.
   * C'est le cas aujourd'hui — {@code PurchaseOrderService.receive} charge le bon d'achat par
   * {@code findByFarmIdAndId} avant d'appeler cette méthode — mais tout futur appelant doit
   * reproduire cette garantie lui-même plutôt que de la supposer ici.
   */
  @Transactional
  public void recordPurchaseOrderDebit(
      Long farmId,
      Long supplierId,
      Long purchaseOrderId,
      String orderNumber,
      long amountXof,
      LocalDate date,
      Long userId) {
    if (amountXof <= 0 || ledgerRepository.existsByPurchaseOrderId(purchaseOrderId)) {
      return;
    }
    SupplierLedgerEntry entry = new SupplierLedgerEntry();
    entry.setFarmId(farmId);
    entry.setSupplierId(supplierId);
    entry.setDirection(LedgerDirection.DEBIT);
    entry.setSource(LedgerSource.PURCHASE_ORDER);
    entry.setAmountXof(amountXof);
    entry.setEntryDate(date);
    entry.setLabel("Bon d'achat " + orderNumber);
    entry.setPurchaseOrderId(purchaseOrderId);
    entry.setCreatedBy(userId);
    ledgerRepository.save(entry);
  }

  /**
   * Seule une ligne saisie à la main s'efface : une ligne dérivée se corrige par son bon d'achat.
   *
   * <p>{@code supplierId} doit correspondre à celui de la ligne : une écriture d'un autre
   * fournisseur de la même ferme répond 404, pas 403 — l'URL ne doit pas trahir qu'une ligne avec
   * cet id existe ailleurs.
   */
  @Transactional
  public void deleteEntry(Long farmId, Long supplierId, Long entryId) {
    SupplierLedgerEntry entry =
        ledgerRepository
            .findByFarmIdAndId(farmId, entryId)
            .orElseThrow(() -> NotFoundException.of("SupplierLedgerEntry", entryId));

    if (!entry.getSupplierId().equals(supplierId)) {
      throw NotFoundException.of("SupplierLedgerEntry", entryId);
    }

    if (entry.getSource() != LedgerSource.MANUAL) {
      throw new BusinessRuleException(
          "LEDGER_ENTRY_DERIVED",
          "A ledger entry derived from a purchase order cannot be deleted; correct the order.");
    }
    ledgerRepository.delete(entry);
  }

  private SupplierLedgerEntry recordManual(
      Long farmId,
      Long supplierId,
      SupplierLedgerCommand cmd,
      LedgerDirection direction,
      Long userId) {
    Supplier supplier = requireSupplier(farmId, supplierId);
    if (cmd.amountXof() <= 0) {
      throw new ValidationException("LEDGER_AMOUNT_NOT_POSITIVE", "Amount must be greater than 0");
    }

    SupplierLedgerEntry entry = new SupplierLedgerEntry();
    entry.setFarmId(farmId);
    entry.setSupplierId(supplierId);
    entry.setDirection(direction);
    entry.setSource(LedgerSource.MANUAL);
    entry.setAmountXof(cmd.amountXof());
    entry.setEntryDate(cmd.entryDate() != null ? cmd.entryDate() : LocalDate.now());
    entry.setLabel(cmd.label());
    entry.setNotes(cmd.notes());
    // method et reference ne valent que pour un versement.
    if (direction == LedgerDirection.CREDIT) {
      entry.setMethod(cmd.method());
      entry.setReference(cmd.reference());
    }
    entry.setCreatedBy(userId);
    entry = ledgerRepository.save(entry);

    if (direction == LedgerDirection.CREDIT && cmd.notifySupplier()) {
      supplierNotifier.paymentRecorded(
          farmId,
          supplier,
          entry.getAmountXof(),
          ledgerRepository.balanceFor(farmId, supplierId),
          entry.getEntryDate());
    }

    return entry;
  }

  private Supplier requireSupplier(Long farmId, Long supplierId) {
    return supplierRepository
        .findByFarmIdAndId(farmId, supplierId)
        .orElseThrow(() -> NotFoundException.of("Supplier", supplierId));
  }
}
