package com.avicare.livestock.inventory;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import com.avicare.livestock.domain.Supplier;
import com.avicare.notification.api.WhatsAppOutboxFacade;
import com.avicare.tenancy.api.TenancyFacade;
import com.avicare.tenancy.api.dto.FarmInfo;
import java.text.NumberFormat;
import java.time.LocalDate;
import java.util.Locale;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.Mockito;

/**
 * Le message part chez un tiers. Les tests portent donc autant sur ce qui NE part PAS que sur le
 * contenu de ce qui part.
 */
class SupplierNotifierTest {

  private final WhatsAppOutboxFacade whatsApp = Mockito.mock(WhatsAppOutboxFacade.class);
  private final TenancyFacade tenancy = Mockito.mock(TenancyFacade.class);
  private final SupplierNotifier notifier = new SupplierNotifier(whatsApp, tenancy);

  @BeforeEach
  void namedFarm() {
    Mockito.lenient()
        .when(tenancy.findById(7L))
        .thenReturn(new FarmInfo(7L, "Ferme Ndiaye", "XOF", "Africa/Dakar", true));
  }

  private static Supplier supplier(boolean notify, String phone) {
    Supplier s = new Supplier();
    s.setId(3L);
    s.setFarmId(7L);
    s.setCommercialName("Provende du Sahel");
    s.setPhone(phone);
    s.setNotifyWhatsapp(notify);
    return s;
  }

  @Test
  void sendsNothingWhenTheSwitchIsOff() {
    notifier.paymentRecorded(
        7L, supplier(false, "+221770000001"), 200_000L, 300_000L, LocalDate.of(2026, 9, 5));

    verify(whatsApp, never()).enqueue(anyString(), anyString());
  }

  @Test
  void sendsNothingWithoutAPhoneNumber() {
    notifier.paymentRecorded(
        7L, supplier(true, null), 200_000L, 300_000L, LocalDate.of(2026, 9, 5));

    verify(whatsApp, never()).enqueue(anyString(), anyString());
  }

  @Test
  void namesTheFarmFirst_thenTheAmountAndWhatRemains() {
    notifier.paymentRecorded(
        7L, supplier(true, "+221770000001"), 200_000L, 300_000L, LocalDate.of(2026, 9, 5));

    ArgumentCaptor<String> message = ArgumentCaptor.forClass(String.class);
    verify(whatsApp).enqueue(any(), message.capture());

    String text = message.getValue();
    // Sans le nom de la ferme, un numéro inconnu écrit des chiffres.
    assertThat(text).startsWith("Ferme Ndiaye");
    assertThat(text).contains(money(200_000L));
    assertThat(text).contains(money(300_000L));
    // Le solde est la position de la ferme, pas une vérité opposable.
    assertThat(text).contains("selon mes comptes");
  }

  @Test
  void announcesAnOrderWithItsNumber() {
    notifier.purchaseOrderSent(7L, supplier(true, "+221770000001"), "BA-12", 450_000L);

    ArgumentCaptor<String> message = ArgumentCaptor.forClass(String.class);
    verify(whatsApp).enqueue(any(), message.capture());
    assertThat(message.getValue()).contains("BA-12").contains(money(450_000L));
  }

  private static String money(long xof) {
    return NumberFormat.getNumberInstance(Locale.FRANCE).format(xof);
  }
}
