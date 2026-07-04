package com.avicare.finance.service;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

/** Unit test for the pure {@link ExpenseCategoryMapper}. */
class ExpenseCategoryMapperTest {

  @Test
  void treatmentSource_mapsToVeterinary() {
    assertThat(ExpenseCategoryMapper.expenseCategoryFor("TREATMENT", null)).isEqualTo("veterinary");
    assertThat(ExpenseCategoryMapper.expenseCategoryFor("TREATMENT", "FEED"))
        .isEqualTo("veterinary");
  }

  @Test
  void inventorySubcategories_map() {
    assertThat(ExpenseCategoryMapper.expenseCategoryFor("INVENTORY", "FEED")).isEqualTo("feed");
    assertThat(ExpenseCategoryMapper.expenseCategoryFor("INVENTORY", "MEDICATION"))
        .isEqualTo("veterinary");
    assertThat(ExpenseCategoryMapper.expenseCategoryFor("INVENTORY", "EQUIPMENT"))
        .isEqualTo("equipment");
    assertThat(ExpenseCategoryMapper.expenseCategoryFor("INVENTORY", "CONSUMABLE"))
        .isEqualTo("other");
    assertThat(ExpenseCategoryMapper.expenseCategoryFor("INVENTORY", null)).isEqualTo("other");
  }
}
