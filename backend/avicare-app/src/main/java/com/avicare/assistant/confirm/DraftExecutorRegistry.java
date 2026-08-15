package com.avicare.assistant.confirm;

import java.util.List;
import java.util.Optional;
import org.springframework.stereotype.Component;

/** Every {@link DraftExecutor} bean, looked up by action name. */
@Component
public class DraftExecutorRegistry {

  private final List<DraftExecutor> executors;

  public DraftExecutorRegistry(List<DraftExecutor> executors) {
    this.executors = List.copyOf(executors);
  }

  public Optional<DraftExecutor> find(String action) {
    return executors.stream().filter(e -> e.action().equals(action)).findFirst();
  }
}
