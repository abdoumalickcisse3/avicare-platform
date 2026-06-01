package com.avicare.parameters.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

import com.avicare.common.api.exception.NotFoundException;
import com.avicare.parameters.domain.PriceList;
import com.avicare.parameters.domain.PriceListItem;
import com.avicare.parameters.repository.PriceListItemRepository;
import com.avicare.parameters.repository.PriceListRepository;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

/** Unit test for {@link PriceListService} (repositories mocked). */
class PriceListServiceTest {

  private PriceListRepository priceListRepository;
  private PriceListItemRepository priceListItemRepository;
  private PriceListService service;

  @BeforeEach
  void setUp() {
    priceListRepository = Mockito.mock(PriceListRepository.class);
    priceListItemRepository = Mockito.mock(PriceListItemRepository.class);
    service = new PriceListService(priceListRepository, priceListItemRepository);
  }

  @Test
  void create_default_clearsPreviousDefault() {
    PriceList previous = new PriceList();
    previous.setDefaultList(true);
    when(priceListRepository.findByFarmIdAndDefaultListTrue(7L)).thenReturn(Optional.of(previous));
    when(priceListRepository.save(any(PriceList.class))).thenAnswer(i -> i.getArgument(0));

    PriceList created = service.create(7L, "Tarifs 2026", true, LocalDate.now(), null);

    assertThat(previous.isDefaultList()).isFalse();
    assertThat(created.isDefaultList()).isTrue();
    assertThat(created.getFarmId()).isEqualTo(7L);
  }

  @Test
  void create_nonDefault_doesNotTouchExistingDefault() {
    when(priceListRepository.save(any(PriceList.class))).thenAnswer(i -> i.getArgument(0));

    service.create(7L, "Promo", false, LocalDate.now(), null);

    Mockito.verify(priceListRepository, Mockito.never()).findByFarmIdAndDefaultListTrue(any());
  }

  @Test
  void upsertItem_updatesExistingByProductKey() {
    when(priceListRepository.findById(3L)).thenReturn(Optional.of(new PriceList()));
    PriceListItem existing = new PriceListItem();
    existing.setPriceListId(3L);
    existing.setProductKey("poulet_vif_kg");
    when(priceListItemRepository.findByPriceListIdAndProductKey(3L, "poulet_vif_kg"))
        .thenReturn(Optional.of(existing));
    when(priceListItemRepository.save(any(PriceListItem.class))).thenAnswer(i -> i.getArgument(0));

    PriceListItem saved = service.upsertItem(3L, "poulet_vif_kg", new BigDecimal("2500.00"), null);

    assertThat(saved.getUnitPrice()).isEqualByComparingTo("2500.00");
    assertThat(saved.getCurrency()).isEqualTo("XOF"); // default kept when blank
  }

  @Test
  void upsertItem_unknownList_throwsNotFound() {
    when(priceListRepository.findById(99L)).thenReturn(Optional.empty());

    assertThatThrownBy(() -> service.upsertItem(99L, "x", BigDecimal.ONE, "XOF"))
        .isInstanceOf(NotFoundException.class);
  }

  @Test
  void removeItem_unknown_throwsNotFound() {
    when(priceListItemRepository.findByPriceListIdAndProductKey(3L, "ghost"))
        .thenReturn(Optional.empty());

    assertThatThrownBy(() -> service.removeItem(3L, "ghost")).isInstanceOf(NotFoundException.class);
  }
}
