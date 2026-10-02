package com.avicare.config;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import org.hibernate.type.format.jackson.Jackson3JsonFormatMapper;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * Hibernate must map JSONB columns with Jackson 3, the version the rest of the app runs on.
 *
 * <p>Its auto-detection does not do that here. {@code SessionFactoryOptionsBuilder} tries, in
 * order: Oracle OSON, <b>Jackson 2</b>, Jackson 3, then JSON-B — and Jackson 2 is still on the
 * classpath because the Anthropic SDK depends on it. So the first candidate wins and every JSONB
 * column is read by a Jackson 2 {@code ObjectMapper}, which cannot construct a {@code
 * tools.jackson.databind.JsonNode}: {@code subscription_change_requests.requested_modules} is
 * declared as one and its round-trip dies with "Cannot construct instance of JsonNode (no
 * Creators…)".
 *
 * <p>The mapper is therefore pinned explicitly. This test guards the setting, which no other test
 * can see without a database — the round-trip that proves it lives in {@code
 * SubscriptionParametersMappingIT}, and that one only runs under Testcontainers (CI).
 *
 * <p>When Jackson 2 eventually leaves the classpath, auto-detection lands on Jackson 3 by itself
 * and the setting becomes redundant — harmless, but removable.
 */
class JsonFormatMapperIsJackson3Test {

  private static final Path APPLICATION_YML =
      Path.of("src", "main", "resources", "application.yml");

  /** The strategy name Hibernate registers for {@link Jackson3JsonFormatMapper}. */
  private static final String JACKSON3_STRATEGY = "jackson3";

  @Test
  void applicationYmlPinsTheJackson3FormatMapper() throws IOException {
    assertThat(APPLICATION_YML).isRegularFile();

    assertThat(Files.readString(APPLICATION_YML).lines().map(String::strip))
        .as(
            "every profile must map JSONB with Jackson 3 — the setting belongs to the base"
                + " application.yml, not to dev/prod, so the test slices get it too")
        .contains("json_format_mapper: " + JACKSON3_STRATEGY);
  }

  @Test
  void jackson3MapperRoundTripsTheJsonNodeWeStoreInJsonbColumns() {
    JsonNode written =
        JsonMapper.builder().build().createObjectNode().put("add", "module.inventory");
    Jackson3JsonFormatMapper mapper = new Jackson3JsonFormatMapper();

    JsonNode read = mapper.fromString(mapper.toString(written, JsonNode.class), JsonNode.class);

    assertThat(read.get("add").asString()).isEqualTo("module.inventory");
  }
}
