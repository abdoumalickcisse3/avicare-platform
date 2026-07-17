package com.avicare.parameters.access;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class CatalogGateTest {

  private final CatalogGate gate = new CatalogGate();

  @Test
  void mapsHealthCategoriesToTheirModule() {
    assertThat(gate.moduleFor("vaccines")).isEqualTo("module.health.basic");
    assertThat(gate.moduleFor("vaccination_programs")).isEqualTo("module.health.basic");
    assertThat(gate.moduleFor("treatments")).isEqualTo("module.health.advanced");
  }

  @Test
  void mapsInventoryItemsToTheInventoryModule() {
    assertThat(gate.moduleFor("inventory_items")).isEqualTo("module.inventory");
  }

  @Test
  void returnsNullForCategoriesWithNoModuleRequirement() {
    assertThat(gate.moduleFor("breeds")).isNull();
    assertThat(gate.moduleFor("expense_categories")).isNull();
    assertThat(gate.moduleFor("something_else")).isNull();
    assertThat(gate.moduleFor(null)).isNull();
  }
}
