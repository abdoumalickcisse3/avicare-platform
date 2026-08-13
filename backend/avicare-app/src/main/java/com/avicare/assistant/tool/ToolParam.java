package com.avicare.assistant.tool;

/**
 * One parameter of an {@link AssistantTool}, described neutrally so the LLM layer can turn it into
 * a provider tool schema without the tool/facade layer ever depending on an SDK.
 *
 * @param name argument name the model fills (matches the key read back from {@code ToolCall.args})
 * @param type JSON-ish type the argument carries
 * @param description guidance shown to the model
 * @param required whether the model must provide it
 */
public record ToolParam(String name, Type type, String description, boolean required) {

  /** The small set of argument shapes the field actions need. */
  public enum Type {
    STRING,
    INTEGER,
    NUMBER,
    INTEGER_ARRAY
  }

  public static ToolParam required(String name, Type type, String description) {
    return new ToolParam(name, type, description, true);
  }

  public static ToolParam optional(String name, Type type, String description) {
    return new ToolParam(name, type, description, false);
  }
}
