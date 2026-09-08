package com.avicare.notification.whatsapp;

import static org.assertj.core.api.Assertions.assertThat;

import com.avicare.notification.domain.Notification;
import java.util.Map;
import org.junit.jupiter.api.Test;

/**
 * A WhatsApp message that says a lot is dying and leaves the reader to go find it stops being
 * acted on. The link must land where the bell lands — a link that disagrees with the app teaches
 * people that the two cannot both be right.
 */
class NotificationDeepLinkTest {

  private static Notification withRef(Map<String, Object> ref) {
    Notification n = new Notification();
    n.setSourceRef(ref);
    return n;
  }

  private final NotificationDeepLink link = new NotificationDeepLink("https://app.jawdi.app");

  @Test
  void lotGoesToItsOwnPage() {
    assertThat(link.urlFor(withRef(Map.of("unitId", 3L))))
        .isEqualTo("https://app.jawdi.app/elevage/lots/3");
  }

  @Test
  void mirrorsTheWebBellForEveryOtherRef() {
    assertThat(link.urlFor(withRef(Map.of("purchaseOrderId", 4L))))
        .isEqualTo("https://app.jawdi.app/stocks/achats");
    assertThat(link.urlFor(withRef(Map.of("itemId", 9L)))).isEqualTo("https://app.jawdi.app/stocks");
    assertThat(link.urlFor(withRef(Map.of("invoiceId", 2L))))
        .isEqualTo("https://app.jawdi.app/commercial/factures");
    assertThat(link.urlFor(withRef(Map.of("clientId", 8L))))
        .isEqualTo("https://app.jawdi.app/commercial/clients");
  }

  /** A bare path in a message would be worse than no link at all. */
  @Test
  void noBaseUrl_noLink() {
    assertThat(new NotificationDeepLink("").urlFor(withRef(Map.of("unitId", 3L)))).isNull();
    assertThat(new NotificationDeepLink(null).urlFor(withRef(Map.of("unitId", 3L)))).isNull();
  }

  @Test
  void trailingSlashDoesNotDoubleUp() {
    assertThat(new NotificationDeepLink("https://app.jawdi.app/").urlFor(withRef(Map.of("itemId", 1L))))
        .isEqualTo("https://app.jawdi.app/stocks");
  }

  @Test
  void nothingToLinkTo_noLink() {
    assertThat(link.urlFor(withRef(Map.of()))).isNull();
    assertThat(link.urlFor(withRef(null))).isNull();
    assertThat(link.urlFor(withRef(Map.of("somethingElse", 1L)))).isNull();
  }
}
