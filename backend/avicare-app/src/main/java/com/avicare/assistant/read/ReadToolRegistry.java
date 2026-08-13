package com.avicare.assistant.read;

import java.util.List;
import java.util.Optional;
import org.springframework.stereotype.Component;

/**
 * The set of read-only capabilities the assistant can consult — every {@link ReadTool} bean,
 * collected by Spring. Adding a consult capability is adding a tool bean. {@code InterpretService}
 * filters this set by the caller's permissions before offering it to the READ agentic loop.
 */
@Component
public class ReadToolRegistry {

  private final List<ReadTool> tools;

  public ReadToolRegistry(List<ReadTool> tools) {
    this.tools = List.copyOf(tools);
  }

  public List<ReadTool> all() {
    return tools;
  }

  public Optional<ReadTool> find(String name) {
    return tools.stream().filter(t -> t.spec().name().equals(name)).findFirst();
  }
}
