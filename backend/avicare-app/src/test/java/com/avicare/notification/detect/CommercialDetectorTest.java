package com.avicare.notification.detect;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import com.avicare.livestock.commercial.CommercialFacade;
import com.avicare.livestock.commercial.CreditExceededInfo;
import com.avicare.livestock.commercial.OverdueInvoiceInfo;
import com.avicare.notification.domain.NotificationCategory;
import com.avicare.notification.domain.NotificationSeverity;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class CommercialDetectorTest {

  @Mock CommercialFacade commercialFacade;
  @InjectMocks CommercialDetector detector;

  @Test
  void ownsInvoiceOverdueAndCreditExceeded() {
    assertThat(detector.categories())
        .containsExactlyInAnyOrder(
            NotificationCategory.INVOICE_OVERDUE, NotificationCategory.CREDIT_EXCEEDED);
  }

  @Test
  void mapsOverdueInvoiceAndOverCreditClient() {
    when(commercialFacade.overdueInvoices(1L))
        .thenReturn(List.of(new OverdueInvoiceInfo(500L, 9L, "Fatou Ndiaye", 200000L, 7L)));
    when(commercialFacade.clientsOverCredit(1L))
        .thenReturn(List.of(new CreditExceededInfo(9L, "Fatou Ndiaye", 600000L, 500000L)));

    List<DetectedCondition> out = detector.detect(1L);

    assertThat(out)
        .anySatisfy(
            c -> {
              assertThat(c.category()).isEqualTo(NotificationCategory.INVOICE_OVERDUE);
              assertThat(c.severity()).isEqualTo(NotificationSeverity.WARNING);
              assertThat(c.dedupKey()).isEqualTo("INVOICE_OVERDUE:invoice:500");
              assertThat(c.sourceRef()).containsEntry("invoiceId", 500L);
            })
        .anySatisfy(
            c -> {
              assertThat(c.category()).isEqualTo(NotificationCategory.CREDIT_EXCEEDED);
              assertThat(c.severity()).isEqualTo(NotificationSeverity.WARNING);
              assertThat(c.dedupKey()).isEqualTo("CREDIT_EXCEEDED:client:9");
              assertThat(c.sourceRef()).containsEntry("clientId", 9L);
            });
  }
}
