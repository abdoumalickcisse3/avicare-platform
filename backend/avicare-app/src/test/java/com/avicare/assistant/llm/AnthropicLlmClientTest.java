package com.avicare.assistant.llm;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.anthropic.client.AnthropicClient;
import com.anthropic.core.JsonValue;
import com.anthropic.models.messages.ContentBlock;
import com.anthropic.models.messages.DirectCaller;
import com.anthropic.models.messages.Message;
import com.anthropic.models.messages.MessageCreateParams;
import com.anthropic.models.messages.TextBlock;
import com.anthropic.models.messages.ToolUseBlock;
import com.anthropic.services.blocking.MessageService;
import com.avicare.assistant.tool.ToolSpec;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

/**
 * Exercises the unified {@code converse} loop's request/response mapping against a mocked SDK
 * client — no cloud call, no key, so it runs in CI. {@code InterpretService} keeps using the
 * deterministic {@link MockLlmClient}; this only proves the Anthropic client's parsing and error
 * handling.
 */
class AnthropicLlmClientTest {

  private static final List<ToolSpec> TOOLS =
      List.of(new ToolSpec("STOCK_QUERY", "Consulter le stock.", List.of()));

  private AnthropicLlmClient clientReturning(Message response) {
    AnthropicClient sdk = mock(AnthropicClient.class);
    MessageService messages = mock(MessageService.class);
    when(sdk.messages()).thenReturn(messages);
    when(messages.create(any(MessageCreateParams.class))).thenReturn(response);
    return new AnthropicLlmClient(sdk, "claude-haiku-4-5", 512L);
  }

  private static Message messageWith(ContentBlock... blocks) {
    Message message = mock(Message.class);
    when(message.content()).thenReturn(List.of(blocks));
    return message;
  }

  @Test
  void mapsToolUseBlocksToInvocations() {
    ToolUseBlock toolUse =
        ToolUseBlock.builder()
            .id("toolu_9")
            .name("STOCK_QUERY")
            .input(JsonValue.from(Map.of("article", "aliment")))
            .caller(DirectCaller.builder().build())
            .build();
    AnthropicLlmClient sut = clientReturning(messageWith(ContentBlock.ofToolUse(toolUse)));

    LlmTurn turn = sut.converse(List.of(LlmMessage.user("quel stock ?")), TOOLS);

    assertThat(turn.hasToolCalls()).isTrue();
    assertThat(turn.toolCalls()).hasSize(1);
    assertThat(turn.toolCalls().get(0).id()).isEqualTo("toolu_9");
    assertThat(turn.toolCalls().get(0).name()).isEqualTo("STOCK_QUERY");
    assertThat(turn.toolCalls().get(0).args()).containsEntry("article", "aliment");
  }

  @Test
  void returnsTheTextAnswerWhenNoToolIsInvoked() {
    ContentBlock textOnly =
        ContentBlock.ofText(
            TextBlock.builder().text("Il reste 40 sacs.").citations(List.of()).build());
    AnthropicLlmClient sut = clientReturning(messageWith(textOnly));

    LlmTurn turn = sut.converse(List.of(LlmMessage.user("stock ?")), TOOLS);

    assertThat(turn.hasToolCalls()).isFalse();
    assertThat(turn.text()).isEqualTo("Il reste 40 sacs.");
  }

  @Test
  void degradesToAnEmptyAnswerWhenTheApiThrows() {
    AnthropicClient sdk = mock(AnthropicClient.class);
    MessageService messages = mock(MessageService.class);
    when(sdk.messages()).thenReturn(messages);
    when(messages.create(any(MessageCreateParams.class)))
        .thenThrow(new RuntimeException("network down"));
    AnthropicLlmClient sut = new AnthropicLlmClient(sdk, "claude-haiku-4-5", 512L);

    LlmTurn turn = sut.converse(List.of(LlmMessage.user("stock ?")), TOOLS);

    assertThat(turn.hasToolCalls()).isFalse();
    assertThat(turn.text()).isEmpty();
  }

  @Test
  void returnsEmptyForEmptyHistoryOrToolsWithoutCallingTheApi() {
    AnthropicClient sdk = mock(AnthropicClient.class);
    AnthropicLlmClient sut = new AnthropicLlmClient(sdk, "claude-haiku-4-5", 512L);

    assertThat(sut.converse(List.of(), TOOLS).text()).isEmpty();
    assertThat(sut.converse(List.of(LlmMessage.user("stock ?")), List.of()).text()).isEmpty();
  }
}
