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
import com.avicare.assistant.llm.ToolCall;
import com.avicare.assistant.llm.ToolInvocation;
import com.avicare.assistant.read.ReadTool;
import com.avicare.assistant.read.ReadToolRegistry;
import com.avicare.assistant.tool.AssistantTool;
import com.avicare.assistant.tool.ToolRegistry;
import com.avicare.assistant.tool.ToolSpec;
import com.avicare.common.security.access.FarmAccessChecker;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

/**
 * The orchestration + RBAC gating live here; each tool's dry-run is tested in its own tool test.
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

  @Test
  void offersOnlyPermittedTools_thenDispatchesToTheChosenTool() {
    AssistantTool mortality = tool("MORTALITY", "poultry:write");
    when(registry.all()).thenReturn(List.of(mortality));
    when(access.hasPermission(1L, "poultry:write")).thenReturn(true);
    when(llm.interpret(any(), any()))
        .thenReturn(Optional.of(new ToolCall("MORTALITY", Map.of("count", 10))));
    when(mortality.dryRun(eq(1L), any(), eq(3L)))
        .thenReturn(InterpretResponse.draft("MORTALITY", 3L, Map.of("count", 10), "ok"));

    InterpretResponse r = service.interpret(1L, "dix sont morts", 3L);

    assertThat(r.kind()).isEqualTo("DRAFT");
    assertThat(r.action()).isEqualTo("MORTALITY");
    verify(mortality).dryRun(eq(1L), any(), eq(3L));
  }

  @Test
  void aFarmerNeverSeesToolsAboveItsPermissions() {
    AssistantTool mortality = tool("MORTALITY", "poultry:write");
    AssistantTool sale = tool("QUICK_SALE", "commercial:write");
    when(registry.all()).thenReturn(List.of(mortality, sale));
    when(access.hasPermission(1L, "poultry:write")).thenReturn(true);
    when(access.hasPermission(1L, "commercial:write")).thenReturn(false); // FARMER
    when(llm.interpret(any(), any())).thenReturn(Optional.empty());

    service.interpret(1L, "vends 30 poulets", null);

    @SuppressWarnings("unchecked")
    ArgumentCaptor<List<ToolSpec>> specs = ArgumentCaptor.forClass(List.class);
    verify(llm).interpret(any(), specs.capture());
    assertThat(specs.getValue()).extracting(ToolSpec::name).containsExactly("MORTALITY");
  }

  @Test
  void noPermittedTools_clarifies() {
    AssistantTool mortality = tool("MORTALITY", "poultry:write");
    when(registry.all()).thenReturn(List.of(mortality));
    when(access.hasPermission(any(), any())).thenReturn(false);

    InterpretResponse r = service.interpret(1L, "dix sont morts", null);

    assertThat(r.kind()).isEqualTo("CLARIFICATION");
    assertThat(r.message()).isNotBlank();
  }

  @Test
  void unrecognized_clarifies() {
    AssistantTool mortality = tool("MORTALITY", "poultry:write");
    when(registry.all()).thenReturn(List.of(mortality));
    when(access.hasPermission(1L, "poultry:write")).thenReturn(true);
    when(llm.interpret(any(), any())).thenReturn(Optional.empty());

    InterpretResponse r = service.interpret(1L, "bonjour", null);

    assertThat(r.kind()).isEqualTo("CLARIFICATION");
  }

  @Test
  void unknownAction_clarifies() {
    AssistantTool mortality = tool("MORTALITY", "poultry:write");
    when(registry.all()).thenReturn(List.of(mortality));
    when(access.hasPermission(1L, "poultry:write")).thenReturn(true);
    when(llm.interpret(any(), any())).thenReturn(Optional.of(new ToolCall("FOO", Map.of())));

    InterpretResponse r = service.interpret(1L, "fais un truc", null);

    assertThat(r.kind()).isEqualTo("CLARIFICATION");
    assertThat(r.message()).contains("non prise en charge");
  }

  @Test
  void readQuestion_runsTheLoop_executesTheTool_andAnswers() {
    // No write tool matched → the read loop runs (write registry empty by default).
    ReadTool stock = readTool("STOCK_QUERY", "inventory:read");
    when(readRegistry.all()).thenReturn(List.of(stock));
    when(access.hasPermission(1L, "inventory:read")).thenReturn(true);
    when(stock.read(eq(1L), any(), eq(2L))).thenReturn("aliment : 40 sac");
    when(llm.converse(any(), any()))
        .thenReturn(
            LlmTurn.calls(List.of(new ToolInvocation("u1", "STOCK_QUERY", Map.of())), null),
            LlmTurn.answer("Il vous reste 40 sacs d'aliment."));

    InterpretResponse r = service.interpret(1L, "quel est mon stock d'aliment ?", 2L);

    assertThat(r.kind()).isEqualTo("ANSWER");
    assertThat(r.message()).isEqualTo("Il vous reste 40 sacs d'aliment.");
    verify(stock).read(eq(1L), any(), eq(2L));
  }

  @Test
  void readLoop_neverOffersToolsAbovePermissions() {
    ReadTool stock = readTool("STOCK_QUERY", "inventory:read");
    ReadTool mortality = readTool("MORTALITY_QUERY", "poultry:read");
    when(readRegistry.all()).thenReturn(List.of(stock, mortality));
    when(access.hasPermission(1L, "inventory:read")).thenReturn(true);
    when(access.hasPermission(1L, "poultry:read")).thenReturn(false); // not allowed
    when(llm.converse(any(), any())).thenReturn(LlmTurn.answer("")); // no answer → clarification

    service.interpret(1L, "combien de morts cette semaine ?", null);

    @SuppressWarnings("unchecked")
    ArgumentCaptor<List<ToolSpec>> specs = ArgumentCaptor.forClass(List.class);
    verify(llm).converse(any(), specs.capture());
    assertThat(specs.getValue()).extracting(ToolSpec::name).containsExactly("STOCK_QUERY");
  }

  @Test
  void readLoop_withoutAnswer_fallsBackToClarification() {
    ReadTool stock = readTool("STOCK_QUERY", "inventory:read");
    when(readRegistry.all()).thenReturn(List.of(stock));
    when(access.hasPermission(1L, "inventory:read")).thenReturn(true);
    when(llm.converse(any(), any())).thenReturn(LlmTurn.answer(""));

    InterpretResponse r = service.interpret(1L, "raconte une blague", null);

    assertThat(r.kind()).isEqualTo("CLARIFICATION");
  }
}
