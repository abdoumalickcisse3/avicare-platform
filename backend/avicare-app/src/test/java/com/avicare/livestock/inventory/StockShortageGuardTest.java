package com.avicare.livestock.inventory;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.catchThrowableOfType;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.avicare.common.api.exception.BusinessRuleException;
import com.avicare.finance.api.FinanceFacade;
import com.avicare.livestock.domain.ArticleSource;
import com.avicare.livestock.domain.MovementReason;
import com.avicare.livestock.domain.MovementType;
import com.avicare.livestock.domain.StockItem;
import com.avicare.livestock.domain.StockMovement;
import com.avicare.livestock.repository.StockItemRepository;
import com.avicare.livestock.repository.StockMovementRepository;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

/**
 * Refuser de sortir du stock qui n'existe pas (ADR-018, révision de la décision 19).
 *
 * <p>Un éleveur pilote l'a demandé après avoir vu son charbon à −1 sac : « si le produit n'existe
 * pas en stock, on ne doit pas pouvoir le consommer ». La garde se pose au seul endroit par où
 * passent toutes les sorties.
 *
 * <p>Deux contraintes la rendent vivable plutôt que punitive. Le refus doit porter les chiffres et
 * l'article, parce que l'écran s'en sert pour proposer d'enregistrer l'entrée manquante ou de
 * compter le stock. Et il ne doit JAMAIS fermer les chemins de sortie : sur une ligne déjà
 * négative, l'entrée et l'inventaire restent les seuls moyens de revenir à zéro.
 */
@ExtendWith(MockitoExtension.class)
class StockShortageGuardTest {

  @Mock StockMovementRepository stockMovementRepository;
  @Mock StockItemRepository stockItemRepository;
  @Mock FinanceFacade financeFacade;
  @Mock InventoryCatalogService inventoryCatalogService;
  @Mock StockShortagePolicy stockShortagePolicy;

  StockMovementService service;

  static final Long FARM = 1L;
  static final Long USER = 42L;
  static final Long ITEM = 6L;

  @BeforeEach
  void setUp() {
    service =
        new StockMovementService(
            stockMovementRepository,
            stockItemRepository,
            financeFacade,
            inventoryCatalogService,
            stockShortagePolicy);
    org.mockito.Mockito.lenient()
        .when(stockMovementRepository.save(any(StockMovement.class)))
        .thenAnswer(i -> i.getArgument(0));
  }

  private StockItem charcoal(String quantity) {
    StockItem item = new StockItem();
    item.setId(ITEM);
    item.setFarmId(FARM);
    item.setArticleSource(ArticleSource.INVENTORY);
    item.setArticleKey("charbon");
    item.setUnit("SAC");
    item.setCurrentQuantity(new BigDecimal(quantity));
    when(stockItemRepository.findByFarmIdAndIdForUpdate(FARM, ITEM)).thenReturn(Optional.of(item));
    return item;
  }

  private StockMovementCommand out(String quantity) {
    return new StockMovementCommand(
        ITEM,
        MovementType.OUT,
        new BigDecimal(quantity),
        MovementReason.CONSUMPTION_LOT,
        LocalDate.of(2026, 10, 13),
        null,
        null,
        null,
        null,
        null,
        null,
        null);
  }

  @Test
  void refusesAnOutflowThatWouldTakeTheStockBelowZero() {
    charcoal("0");
    when(stockShortagePolicy.isBlockingFor(FARM)).thenReturn(true);

    assertThatThrownBy(() -> service.recordMovement(FARM, out("1"), USER))
        .isInstanceOf(BusinessRuleException.class)
        .extracting(e -> ((BusinessRuleException) e).getCode())
        .isEqualTo("STOCK_INSUFFICIENT");

    verify(stockMovementRepository, never()).save(any());
  }

  @Test
  void theRefusalCarriesWhatTheScreenNeedsToOfferAWayOut() {
    charcoal("0");
    when(stockShortagePolicy.isBlockingFor(FARM)).thenReturn(true);
    when(inventoryCatalogService.listAllAvailableArticles(FARM))
        .thenReturn(
            List.of(
                new InventoryCatalogItemDto(
                    "charbon",
                    ArticleSource.INVENTORY,
                    "CHARBON",
                    "CONSUMABLE",
                    "SAC",
                    6100,
                    true)));

    BusinessRuleException refusal =
        catchThrowableOfType(
            () -> service.recordMovement(FARM, out("1"), USER), BusinessRuleException.class);

    assertThat(refusal.getProperties())
        .containsEntry("stockItemId", ITEM)
        .containsEntry("articleKey", "charbon")
        .containsEntry("articleLabel", "CHARBON")
        .containsEntry("unit", "SAC")
        .containsEntry("available", new BigDecimal("0"))
        .containsEntry("requested", new BigDecimal("1"));
    // Le message nomme les deux chiffres : « il en reste tant, vous en sortez tant ».
    assertThat(refusal.getMessage()).contains("CHARBON").contains("0").contains("1");
  }

  /**
   * Vider le stock jusqu'à zéro reste une sortie normale — et le réglage n'est même pas lu : tant
   * que le solde ne passe pas sous zéro, la garde ne coûte pas un aller-retour en base.
   */
  @Test
  void letsAnOutflowEmptyTheStockExactly() {
    charcoal("2");

    StockMovement movement = service.recordMovement(FARM, out("2"), USER);

    assertThat(movement.getQuantityAfter()).isEqualByComparingTo("0");
    verify(stockShortagePolicy, never()).isBlockingFor(anyLong());
  }

  @Test
  void letsTheOutflowThroughWhenTheFarmTurnedTheGuardOff() {
    charcoal("0");
    when(stockShortagePolicy.isBlockingFor(FARM)).thenReturn(false);

    StockMovement movement = service.recordMovement(FARM, out("1"), USER);

    assertThat(movement.getQuantityAfter()).isEqualByComparingTo("-1");
  }

  /**
   * Sur une ligne déjà négative, l'entrée et l'inventaire sont les deux seules portes de sortie.
   * Les fermer enfermerait l'éleveur dans son erreur — c'est le scénario du pilote, dont les trois
   * lignes négatives doivent pouvoir être régularisées une fois la garde en place.
   */
  @Test
  void neverBlocksAnInflowOnAnAlreadyNegativeLine() {
    charcoal("-1");

    StockMovementCommand in =
        new StockMovementCommand(
            ITEM,
            MovementType.IN,
            new BigDecimal("3"),
            MovementReason.RECEPTION_PURCHASE,
            LocalDate.of(2026, 10, 14),
            null,
            null,
            null,
            null,
            null,
            null,
            null);

    assertThat(service.recordMovement(FARM, in, USER).getQuantityAfter()).isEqualByComparingTo("2");
    verify(stockShortagePolicy, never()).isBlockingFor(anyLong());
  }

  /**
   * Une vente n'est pas une consommation, et la garde ne la touche pas.
   *
   * <p>Refuser une consommation force la saisie de l'entrée manquante : la donnée s'améliore.
   * Refuser une vente déjà encaissée empêche d'enregistrer de l'argent reçu : la donnée se perd,
   * parce que l'éleveur passera outre et ne saisira rien. Et vendre plus de sujets que la bande
   * n'en porte est déjà refusé en amont par la décision 27 ({@code PRODUCTION_INSUFFICIENT}), qui
   * est la vraie garde du commerce.
   */
  @Test
  void doesNotBlockASale_thatGuardBelongsToProduction() {
    charcoal("0");

    StockMovementCommand sale =
        new StockMovementCommand(
            ITEM,
            MovementType.OUT,
            new BigDecimal("1"),
            MovementReason.SALE,
            LocalDate.of(2026, 10, 14),
            null,
            null,
            null,
            null,
            null,
            null,
            null);

    assertThat(service.recordMovement(FARM, sale, USER).getQuantityAfter())
        .isEqualByComparingTo("-1");
    verify(stockShortagePolicy, never()).isBlockingFor(anyLong());
  }

  @Test
  void neverBlocksAnInventoryCountOnAnAlreadyNegativeLine() {
    charcoal("-1");

    StockMovementCommand count =
        new StockMovementCommand(
            ITEM,
            MovementType.ADJUSTMENT,
            new BigDecimal("4"),
            MovementReason.INVENTORY_PHYSICAL,
            LocalDate.of(2026, 10, 14),
            null,
            null,
            null,
            null,
            null,
            null,
            null);

    assertThat(service.recordMovement(FARM, count, USER).getQuantityAfter())
        .isEqualByComparingTo("4");
    verify(stockShortagePolicy, never()).isBlockingFor(anyLong());
  }
}
