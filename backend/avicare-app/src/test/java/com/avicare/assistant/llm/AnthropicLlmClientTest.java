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
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.Test;

/**
 * Exercises the tool_use → {@link ToolCall} mapping against a mocked SDK client — no cloud call, no
 * key, so it runs in CI. {@code InterpretService} keeps using the deterministic {@link
 * MockLlmClient}; this only proves the Anthropic client's parsing and error handling.
 */
class AnthropicLlmClientTest {

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
  void mapsAToolUseBlockToAToolCall() {
    ToolUseBlock toolUse =
        ToolUseBlock.builder()
            .id("toolu_1")
            .name("MORTALITY")
            .input(JsonValue.from(Map.of("count", 12, "reason", "chaleur")))
            .caller(DirectCaller.builder().build())
            .build();
    AnthropicLlmClient sut = clientReturning(messageWith(ContentBlock.ofToolUse(toolUse)));

    Optional<ToolCall> call =
        sut.interpret("douze sont morts à cause de la chaleur", List.of("MORTALITY"));

    assertThat(call).isPresent();
    assertThat(call.get().action()).isEqualTo("MORTALITY");
    assertThat(call.get().args()).containsEntry("count", 12).containsEntry("reason", "chaleur");
  }

  @Test
  void returnsEmptyWhenTheModelInvokesNoTool() {
    ContentBlock textOnly =
        ContentBlock.ofText(
            TextBlock.builder().text("Je n'ai pas compris.").citations(List.of()).build());
    AnthropicLlmClient sut = clientReturning(messageWith(textOnly));

    assertThat(sut.interpret("bonjour", List.of("MORTALITY"))).isEmpty();
  }

  @Test
  void degradesToEmptyWhenTheApiThrows() {
    AnthropicClient sdk = mock(AnthropicClient.class);
    MessageService messages = mock(MessageService.class);
    when(sdk.messages()).thenReturn(messages);
    when(messages.create(any(MessageCreateParams.class)))
        .thenThrow(new RuntimeException("network down"));
    AnthropicLlmClient sut = new AnthropicLlmClient(sdk, "claude-haiku-4-5", 512L);

    assertThat(sut.interpret("dix sont morts", List.of("MORTALITY"))).isEmpty();
  }

  @Test
  void ignoresBlankTextAndEmptyActionsWithoutCallingTheApi() {
    AnthropicClient sdk = mock(AnthropicClient.class);
    AnthropicLlmClient sut = new AnthropicLlmClient(sdk, "claude-haiku-4-5", 512L);

    assertThat(sut.interpret("   ", List.of("MORTALITY"))).isEmpty();
    assertThat(sut.interpret("dix sont morts", List.of())).isEmpty();
  }
}
