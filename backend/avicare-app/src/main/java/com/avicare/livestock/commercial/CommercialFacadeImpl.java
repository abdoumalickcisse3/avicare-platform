package com.avicare.livestock.commercial;

import com.avicare.common.api.dto.ActivityItem;
import com.avicare.common.api.dto.DayValue;
import com.avicare.common.api.dto.NamedValue;
import com.avicare.livestock.commercial.dto.CommercialStats;
import com.avicare.livestock.domain.Client;
import com.avicare.livestock.domain.Invoice;
import com.avicare.livestock.domain.InvoiceStatus;
import com.avicare.livestock.domain.Payment;
import com.avicare.livestock.domain.PaymentMethod;
import com.avicare.livestock.domain.Sale;
import com.avicare.livestock.domain.SaleStatus;
import com.avicare.livestock.repository.InvoiceRepository;
import com.avicare.livestock.repository.OrderRepository;
import com.avicare.livestock.repository.PaymentRepository;
import com.avicare.livestock.repository.SaleItemRepository;
import com.avicare.livestock.repository.SaleRepository;
import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.stream.Stream;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Public read surface of the {@code commercial} sub-domain (doc 03 §4.9). Delegates to the
 * commercial services and maps their entities to the public {@link ClientCreditInfo} / {@link
 * InvoiceInfo} records, so consumers never touch the domain entities.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class CommercialFacadeImpl implements CommercialFacade {

  private final ClientService clientService;
  private final InvoiceService invoiceService;
  private final PaymentService paymentService;
  private final SaleRepository saleRepository;
  private final InvoiceRepository invoiceRepository;
  private final OrderRepository orderRepository;
  private final SaleItemRepository saleItemRepository;
  private final PaymentRepository paymentRepository;

  @Override
  public ClientCreditInfo getClientCredit(Long farmId, Long clientId) {
    Client client = clientService.getById(farmId, clientId);
    CreditStatus credit = clientService.projectCredit(farmId, clientId, 0L);
    return new ClientCreditInfo(
        client.getId(),
        client.getDisplayName(),
        client.getCreditLimitXof(),
        client.getCurrentBalanceXof(),
        credit.overLimit(),
        credit.overLimitPercent());
  }

  @Override
  public List<ClientLite> listClients(Long farmId) {
    return clientService.listForFarm(farmId).stream()
        .map(c -> new ClientLite(c.getId(), c.getDisplayName(), c.getCurrentBalanceXof()))
        .toList();
  }

  @Override
  @Transactional
  public void recordPayment(
      Long farmId, Long invoiceId, long amountXof, String method, Long userId) {
    PaymentMethod paymentMethod =
        method == null || method.isBlank() ? PaymentMethod.CASH : PaymentMethod.valueOf(method);
    paymentService.record(
        farmId, new PaymentCommand(invoiceId, amountXof, paymentMethod, null, null, null), userId);
  }

  @Override
  public Optional<OpenInvoiceInfo> oldestOpenInvoiceForClient(Long farmId, Long clientId) {
    // Repository returns issue-date DESC, id DESC → the oldest open one is the last match.
    List<Invoice> open =
        invoiceRepository
            .findByFarmIdAndClientIdOrderByIssueDateDescIdDesc(farmId, clientId)
            .stream()
            .filter(CommercialFacadeImpl::isOpen)
            .toList();
    if (open.isEmpty()) {
      return Optional.empty();
    }
    Invoice oldest = open.get(open.size() - 1);
    return Optional.of(
        new OpenInvoiceInfo(oldest.getId(), oldest.getInvoiceNumber(), oldest.outstandingXof()));
  }

  private static boolean isOpen(Invoice invoice) {
    return (invoice.getStatus() == InvoiceStatus.ISSUED
            || invoice.getStatus() == InvoiceStatus.PARTIALLY_PAID)
        && invoice.outstandingXof() > 0;
  }

  @Override
  public InvoiceInfo findInvoiceById(Long farmId, Long invoiceId) {
    Invoice invoice = invoiceService.getById(farmId, invoiceId);
    return new InvoiceInfo(
        invoice.getId(),
        invoice.getInvoiceNumber(),
        invoice.getClient() != null ? invoice.getClient().getId() : null,
        invoice.getStatus(),
        invoice.getTotalXof(),
        invoice.getAmountPaidXof(),
        invoice.outstandingXof(),
        invoice.getIssueDate(),
        invoice.getDueDate());
  }

  @Override
  public CommercialStats commercialStats(Long farmId, LocalDate from, LocalDate to) {
    LocalDate today = LocalDate.now();
    Pageable top5 = PageRequest.of(0, 5);

    // Period KPIs — honour [from, to].
    long revenueXof = coalesce(saleRepository.sumRevenueByPeriod(farmId, from, to));
    List<DayValue> revenueSeries =
        saleRepository.sumRevenueByDay(farmId, from, to).stream()
            .map(row -> new DayValue((LocalDate) row[0], ((Number) row[1]).longValue()))
            .toList();
    List<NamedValue> topClients =
        saleRepository.topClientsByRevenue(farmId, from, to, top5).stream()
            .map(
                row ->
                    new NamedValue(
                        ((Number) row[0]).longValue(),
                        (String) row[1],
                        ((Number) row[2]).longValue()))
            .toList();

    // Snapshot KPIs — current state, period-independent.
    long outstandingXof = invoiceRepository.sumOutstanding(farmId);
    long overdueXof = invoiceRepository.sumOverdue(farmId, today);
    long invoicesToCollect = invoiceRepository.countToCollect(farmId);
    List<NamedValue> topDebtors =
        invoiceRepository.topDebtors(farmId).stream()
            .map(
                row ->
                    new NamedValue(
                        ((Number) row[0]).longValue(),
                        (String) row[1],
                        ((Number) row[2]).longValue()))
            .toList();
    long ordersToDeliver = orderRepository.countToDeliver(farmId);

    return new CommercialStats(
        revenueXof,
        revenueSeries,
        outstandingXof,
        overdueXof,
        topClients,
        topDebtors,
        ordersToDeliver,
        invoicesToCollect);
  }

  @Override
  public long revenueByProductionUnit(Long farmId, Long productionUnitId) {
    return saleItemRepository.sumRevenueForUnit(farmId, productionUnitId);
  }

  @Override
  public long totalSalesRevenue(Long farmId) {
    return saleRepository.sumAllRevenue(farmId);
  }

  @Override
  public long totalPaidFromDeliveryInvoices(Long farmId) {
    return invoiceRepository.sumPaidFromDeliveries(farmId);
  }

  @Override
  public List<ActivityItem> recentActivity(Long farmId, int limit) {
    Pageable page = PageRequest.of(0, limit);
    Stream<ActivityItem> sales =
        saleRepository
            .findByFarmIdAndStatusOrderBySaleDateDescIdDesc(farmId, SaleStatus.COMPLETED, page)
            .stream()
            .map(CommercialFacadeImpl::saleToActivity);
    Stream<ActivityItem> payments =
        paymentRepository.findByFarmIdOrderByPaymentDateDescIdDesc(farmId, page).stream()
            .map(CommercialFacadeImpl::paymentToActivity);
    return Stream.concat(sales, payments)
        .sorted(
            Comparator.comparing(ActivityItem::at, Comparator.nullsLast(Comparator.reverseOrder())))
        .limit(limit)
        .toList();
  }

  private static ActivityItem saleToActivity(Sale s) {
    return new ActivityItem("SALE", s.getCreatedAt(), "Vente " + s.getTotalXof() + " XOF", null);
  }

  private static ActivityItem paymentToActivity(Payment p) {
    return new ActivityItem(
        "PAYMENT", p.getCreatedAt(), "Paiement reçu " + p.getAmountXof() + " XOF", null);
  }

  /** Null-safe coalesce for aggregate SUM results that return null when no rows match. */
  private static long coalesce(Long value) {
    return value != null ? value : 0L;
  }
}
