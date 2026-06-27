package com.avicare.livestock.commercial;

import com.avicare.common.api.dto.DayValue;
import com.avicare.common.api.dto.NamedValue;
import com.avicare.livestock.commercial.dto.CommercialStats;
import com.avicare.livestock.domain.Client;
import com.avicare.livestock.domain.Invoice;
import com.avicare.livestock.repository.InvoiceRepository;
import com.avicare.livestock.repository.OrderRepository;
import com.avicare.livestock.repository.SaleRepository;
import java.time.LocalDate;
import java.util.List;
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
  private final SaleRepository saleRepository;
  private final InvoiceRepository invoiceRepository;
  private final OrderRepository orderRepository;

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

  /** Null-safe coalesce for aggregate SUM results that return null when no rows match. */
  private static long coalesce(Long value) {
    return value != null ? value : 0L;
  }
}
