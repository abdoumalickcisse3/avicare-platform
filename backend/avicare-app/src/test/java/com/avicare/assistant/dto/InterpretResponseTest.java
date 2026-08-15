package com.avicare.assistant.dto;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Map;
import org.junit.jupiter.api.Test;

class InterpretResponseTest {

  @Test
  void draftRisk_isDerivedFromTheAction() {
    assertThat(InterpretResponse.draft("QUICK_SALE", null, Map.of(), "x").risk()).isEqualTo("HIGH");
    assertThat(InterpretResponse.draft("RECORD_PAYMENT", null, Map.of(), "x").risk())
        .isEqualTo("HIGH");
    assertThat(InterpretResponse.draft("MORTALITY", 3L, Map.of(), "x").risk()).isEqualTo("MEDIUM");
    assertThat(InterpretResponse.draft("EGG_COLLECTION", 3L, Map.of(), "x").risk())
        .isEqualTo("LOW");
    assertThat(InterpretResponse.draft("HEALTH_OBSERVATION", 3L, Map.of(), "x").risk())
        .isEqualTo("LOW");
  }

  @Test
  void nonDraftKinds_carryNoRisk() {
    assertThat(InterpretResponse.clarification("?").risk()).isNull();
    assertThat(InterpretResponse.answer("40 sacs").risk()).isNull();
  }
}
