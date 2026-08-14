package com.avicare.assistant.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.avicare.assistant.dto.InterpretResponse;
import com.avicare.assistant.llm.LlmClient;
import com.avicare.assistant.llm.LlmTurn;
import com.avicare.assistant.llm.ToolInvocation;
import com.avicare.assistant.read.ReadTool;
import com.avicare.assistant.read.ReadToolRegistry;
import com.avicare.assistant.tool.AssistantTool;
import com.avicare.assistant.tool.ToolRegistry;
import com.avicare.assistant.tool.ToolSpec;
import com.avicare.common.security.access.FarmAccessChecker;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

/**
 * The unified-loop orchestration + RBAC gating live here; each tool's dry-run/read is tested in its
 * own tool test. Everything now flows through a single {@code llm.converse}.
 */
@ExtendWith(MockitoExtension.class)
class InterpretServiceTest {

  @Mock private LlmClient llm;
  @Mock private ToolRegistry registry;
  @Mock private ReadToolRegistry readRegistry;
  @Mock private FarmAccessChecker access;
  @InjectMocks private InterpretService service;

  private static AssistantTool tool(String name, String permission) {
    AssistantTool t = mock(AssistantTool.class);
    lenient().when(t.spec()).thenReturn(new ToolSpec(name, name, List.of()));
    lenient().when(t.requiredPermission()).thenReturn(permission);
    return t;
  }

  private static ReadTool readTool(String name, String permission) {
    ReadTool t = mock(ReadTool.class);
    lenient().when(t.spec()).thenReturn(new ToolSpec(name, name, List.of()));
    lenient().when(t.requiredPermission()).thenReturn(permission);
    return t;
  }

  private static LlmTurn call(String name, Map<String, Object> args) {
    return LlmTurn.calls(List.of(new ToolInvocation("u1", name, args)), null);
  }

  @Test
  void aWriteToolCall_isDryRunIntoADraftAndStops() {
    AssistantTool mortality = tool("MORTALITY", "poultry:write");
    when(registry.all()).thenReturn(List.of(mortality));
    when(access.hasPermission(1L, "poultry:write")).thenReturn(true);
    when(llm.converse(any(), any())).thenReturn(call("MORTALITY", Map.of("count", 10)));
    when(mortality.dryRun(eq(1L), any(), eq(3L)))
        .thenReturn(InterpretResponse.draft("MORTALITY", 3L, Map.of("count", 10), "ok"));

    InterpretResponse r = service.interpret(1L, "dix sont morts", 3L);

    assertThat(r.kind()).isEqualTo("DRAFT");
    assertThat(r.action()).isEqualTo("MORTALITY");
    verify(mortality).dryRun(eq(1L), any(), eq(3L));
  }

  @Test
  void offersWriteAndReadToolsTogether_scopedToPermissions() {
    AssistantTool mortality = tool("MORTALITY", "poultry:write");
    AssistantTool sale = tool("QUICK_SALE", "commercial:write");
    ReadTool stock = readTool("STOCK_QUERY", "inventory:read");
    when(registry.all()).thenReturn(List.of(mortality, sale));
    when(readRegistry.all()).thenReturn(List.of(stock));
    when(access.hasPermission(1L, "poultry:write")).thenReturn(true);
    when(access.hasPermission(1L, "commercial:write")).thenReturn(false); // FARMER
    when(access.hasPermission(1L, "inventory:read")).thenReturn(true);
    when(llm.converse(any(), any())).thenReturn(LlmTurn.answer(""));

    service.interpret(1L, "bonjour", null);

    @SuppressWarnings("unchecked")
    ArgumentCaptor<List<ToolSpec>> specs = ArgumentCaptor.forClass(List.class);
    verify(llm).converse(any(), specs.capture());
    // The forbidden write tool is never even offered; write + read are offered together.
    assertThat(specs.getValue())
        .extracting(ToolSpec::name)
        .containsExactlyInAnyOrder("MORTALITY", "STOCK_QUERY");
  }

  @Test
  void readQuestion_executesTheTool_feedsItBack_andAnswers() {
    ReadTool stock = readTool("STOCK_QUERY", "inventory:read");
    when(readRegistry.all()).thenReturn(List.of(stock));
    when(access.hasPermission(1L, "inventory:read")).thenReturn(true);
    when(stock.read(eq(1L), any(), eq(2L))).thenReturn("aliment : 40 sac");
    when(llm.converse(any(), any()))
        .thenReturn(
            call("STOCK_QUERY", Map.of()), LlmTurn.answer("Il vous reste 40 sacs d'aliment."));

    InterpretResponse r = service.interpret(1L, "quel est mon stock d'aliment ?", 2L);

    assertThat(r.kind()).isEqualTo("ANSWER");
    assertThat(r.message()).isEqualTo("Il vous reste 40 sacs d'aliment.");
    verify(stock).read(eq(1L), any(), eq(2L));
  }

  @Test
  void noPermittedTools_clarifiesWithoutCallingTheModel() {
    AssistantTool mortality = tool("MORTALITY", "poultry:write");
    when(registry.all()).thenReturn(List.of(mortality));
    when(access.hasPermission(any(), any())).thenReturn(false);

    InterpretResponse r = service.interpret(1L, "dix sont morts", null);

    assertThat(r.kind()).isEqualTo("CLARIFICATION");
    assertThat(r.message()).isNotBlank();
  }

  @Test
  void plainTextWithNoTool_clarifies() {
    AssistantTool mortality = tool("MORTALITY", "poultry:write");
    when(registry.all()).thenReturn(List.of(mortality));
    when(access.hasPermission(1L, "poultry:write")).thenReturn(true);
    when(llm.converse(any(), any())).thenReturn(LlmTurn.answer(""));

    InterpretResponse r = service.interpret(1L, "bonjour", null);

    assertThat(r.kind()).isEqualTo("CLARIFICATION");
  }

  @Test
  void aRunawayModel_isCappedIntoAClarification() {
    // A tool call matching neither registry loops (treated as a read with no handler) until the
    // cap.
    AssistantTool mortality = tool("MORTALITY", "poultry:write");
    when(registry.all()).thenReturn(List.of(mortality));
    when(access.hasPermission(1L, "poultry:write")).thenReturn(true);
    when(llm.converse(any(), any())).thenReturn(call("FOO", Map.of()));

    InterpretResponse r = service.interpret(1L, "fais un truc", null);

    assertThat(r.kind()).isEqualTo("CLARIFICATION");
  }
}
