package com.avicare.livestock.inventory;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.spy;
import static org.mockito.Mockito.when;

import com.avicare.common.api.exception.BusinessRuleException;
import com.avicare.common.api.exception.NotFoundException;
import com.avicare.livestock.domain.ArticleSource;
import com.avicare.livestock.domain.FeedFormula;
import com.avicare.livestock.domain.FormulaIngredient;
import com.avicare.livestock.repository.FeedFormulaRepository;
import com.avicare.parameters.api.ParametersFacade;
import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

/** Unit test for {@link FeedFormulaService#resolveIngredients}. */
@ExtendWith(MockitoExtension.class)
class FeedFormulaServiceResolveTest {

  @Mock FeedFormulaRepository feedFormulaRepository;
  @Mock ParametersFacade parametersFacade;
  @Mock InventoryCatalogService inventoryCatalogService;

  FeedFormulaService service;

  static final Long FARM = 1L;

  @BeforeEach
  void setUp() {
    service =
        new FeedFormulaService(feedFormulaRepository, parametersFacade, inventoryCatalogService);
  }

  private static FormulaIngredient ing(String key, int pct) {
    return new FormulaIngredient(key, ArticleSource.INVENTORY, new BigDecimal(pct));
  }

  @Test
  void resolvesFarmFormulaById() {
    FeedFormula f = new FeedFormula();
    f.setIngredients(List.of(ing("mais", 60), ing("soja", 40)));
    when(feedFormulaRepository.findByFarmIdAndIdAndActiveTrue(FARM, 7L)).thenReturn(Optional.of(f));

    List<FormulaIngredient> out = service.resolveIngredients(FARM, null, 7L);

    assertThat(out).extracting(FormulaIngredient::articleKey).containsExactly("mais", "soja");
  }

  @Test
  void resolvesPlatformFormulaByKey() {
    FeedFormulaService spy = spy(service);
    PlatformFormulaDto dto =
        new PlatformFormulaDto(
            "starter", "Démarrage", List.of(), null, null, null, List.of(ing("mais", 100)), null);
    doReturn(dto).when(spy).getPlatformFormula(FARM, "starter");

    assertThat(spy.resolveIngredients(FARM, "starter", null))
        .extracting(FormulaIngredient::articleKey)
        .containsExactly("mais");
  }

  @Test
  void missingFarmFormulaThrowsNotFound() {
    when(feedFormulaRepository.findByFarmIdAndIdAndActiveTrue(FARM, 7L))
        .thenReturn(Optional.empty());
    assertThatThrownBy(() -> service.resolveIngredients(FARM, null, 7L))
        .isInstanceOf(NotFoundException.class);
  }

  @Test
  void noReferenceThrowsBusinessRule() {
    assertThatThrownBy(() -> service.resolveIngredients(FARM, null, null))
        .isInstanceOf(BusinessRuleException.class);
  }
}
