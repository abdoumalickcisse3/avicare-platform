package com.avicare.livestock.commercial;

import com.avicare.livestock.domain.Client;
import com.avicare.livestock.domain.Invoice;
import lombok.RequiredArgsConstructor;
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
}
