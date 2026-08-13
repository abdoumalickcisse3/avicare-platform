package com.avicare.assistant.tool;

import java.util.List;
import java.util.Optional;
import org.springframework.stereotype.Component;

/**
 * The set of capabilities the assistant knows about — every {@link AssistantTool} bean, collected
 * by Spring. Adding a capability is adding a tool bean; nothing here changes. {@code
 * InterpretService} filters this set by the caller's permissions before offering it to the model.
 */
@Component
public class ToolRegistry {

  private final List<AssistantTool> tools;

  public ToolRegistry(List<AssistantTool> tools) {
    this.tools = List.copyOf(tools);
  }

  public List<AssistantTool> all() {
    return tools;
  }

  public Optional<AssistantTool> find(String name) {
    return tools.stream().filter(t -> t.spec().name().equals(name)).findFirst();
  }
}
