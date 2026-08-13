package com.avicare.assistant.llm;

import com.anthropic.client.AnthropicClient;
import com.anthropic.client.okhttp.AnthropicOkHttpClient;
import com.anthropic.core.JsonValue;
import com.anthropic.models.messages.ContentBlock;
import com.anthropic.models.messages.Message;
import com.anthropic.models.messages.MessageCreateParams;
import com.anthropic.models.messages.Tool;
import com.anthropic.models.messages.ToolUseBlock;
import com.avicare.assistant.tool.ToolParam;
import com.avicare.assistant.tool.ToolSpec;
import com.fasterxml.jackson.core.type.TypeReference;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Primary;
import org.springframework.stereotype.Component;

/**
 * Real, Anthropic-backed {@link LlmClient}. Turns free French field text into a {@link ToolCall}
 * via the Messages API in tool-use mode: each available action is offered as a tool, the model
 * picks one and fills its arguments. The model is strictly bounded — it extracts intent and
 * entities only; {@code InterpretService} still validates everything against the domain (dry-run)
 * and the human confirms before any write (doc 12 §4).
 *
 * <p>Active only when {@code anthropic.api-key} is present (in prod, from the {@code
 * ANTHROPIC_API_KEY} env var). When it is absent — dev, CI, DB-less tests — this bean is not
 * created and {@link MockLlmClient} is used instead, so the whole chain stays testable without a
 * key. When both exist this one is {@link Primary}.
 */
@Component
@Primary
@ConditionalOnProperty(prefix = "anthropic", name = "api-key")
public class AnthropicLlmClient implements LlmClient {

  private static final Logger log = LoggerFactory.getLogger(AnthropicLlmClient.class);

  private static final String SYSTEM_PROMPT =
      "Tu es l'assistant de saisie d'une application d'élevage avicole. L'ouvrier de terrain parle"
          + " en français, souvent brièvement. À partir de sa phrase, choisis AU PLUS UNE action"
          + " parmi les outils disponibles et remplis ses champs. Tu extrais uniquement l'intention"
          + " et les entités (quantités, motif, lot…) : tu ne calcules jamais et ne décides jamais"
          + " un montant, un stock ou un solde — le système s'en charge. Si la phrase ne correspond"
          + " à aucune action, ou qu'un nombre requis est absent, n'appelle aucun outil.";

  private final AnthropicClient client;
  private final String model;
  private final long maxTokens;

  public AnthropicLlmClient(
      @Value("${anthropic.api-key}") String apiKey,
      @Value("${anthropic.model:claude-haiku-4-5}") String model,
      @Value("${anthropic.max-tokens:512}") long maxTokens,
      @Value("${anthropic.timeout-seconds:12}") long timeoutSeconds) {
    this(
        AnthropicOkHttpClient.builder()
            .apiKey(apiKey)
            .timeout(Duration.ofSeconds(timeoutSeconds))
            .build(),
        model,
        maxTokens);
    log.info("Anthropic LLM client active (model={})", model);
  }

  /** Test seam: inject a pre-built (mocked) client. */
  AnthropicLlmClient(AnthropicClient client, String model, long maxTokens) {
    this.client = client;
    this.model = model;
    this.maxTokens = maxTokens;
  }

  @Override
  public Optional<ToolCall> interpret(String text, List<ToolSpec> tools) {
    if (text == null || text.isBlank() || tools.isEmpty()) {
      return Optional.empty();
    }
    try {
      MessageCreateParams.Builder params =
          MessageCreateParams.builder()
              .model(model)
              .maxTokens(maxTokens)
              .system(SYSTEM_PROMPT)
              .addUserMessage(text);
      for (ToolSpec spec : tools) {
        params.addTool(toSdkTool(spec));
      }
      return firstToolCall(client.messages().create(params.build()));
    } catch (RuntimeException e) {
      // Network, timeout or parse failure — degrade to a clarification, never fail the request.
      log.warn("Anthropic interpret failed ({}); falling back to clarification", e.toString());
      return Optional.empty();
    }
  }

  /** The first tool the model invoked, mapped to a {@link ToolCall}; empty if it invoked none. */
  private static Optional<ToolCall> firstToolCall(Message response) {
    for (ContentBlock block : response.content()) {
      Optional<ToolUseBlock> toolUse = block.toolUse();
      if (toolUse.isPresent()) {
        ToolUseBlock b = toolUse.get();
        Map<String, Object> args = b._input().convert(new TypeReference<Map<String, Object>>() {});
        return Optional.of(new ToolCall(b.name(), args == null ? Map.of() : args));
      }
    }
    return Optional.empty();
  }

  /** Build the provider tool schema from a neutral {@link ToolSpec}. */
  private static Tool toSdkTool(ToolSpec spec) {
    Tool.InputSchema.Properties.Builder properties = Tool.InputSchema.Properties.builder();
    Tool.InputSchema.Builder schema = Tool.InputSchema.builder();
    for (ToolParam param : spec.parameters()) {
      properties.putAdditionalProperty(param.name(), JsonValue.from(schemaFor(param)));
      if (param.required()) {
        schema.addRequired(param.name());
      }
    }
    return Tool.builder()
        .name(spec.name())
        .description(spec.description())
        .inputSchema(schema.properties(properties.build()).build())
        .build();
  }

  /** JSON-schema fragment for one parameter. */
  private static Map<String, Object> schemaFor(ToolParam param) {
    Map<String, Object> node = new LinkedHashMap<>();
    switch (param.type()) {
      case STRING -> node.put("type", "string");
      case INTEGER -> node.put("type", "integer");
      case NUMBER -> node.put("type", "number");
      case INTEGER_ARRAY -> {
        node.put("type", "array");
        node.put("items", Map.of("type", "integer"));
      }
    }
    node.put("description", param.description());
    return node;
  }
}
