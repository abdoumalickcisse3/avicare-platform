package com.avicare.notification.push;

import java.util.Collection;
import java.util.List;
import java.util.Map;

/**
 * Sends pushes through the Expo Push Service. Best-effort: implementations never throw — a failure
 * comes back as a {@link PushResult} per message, in the order the messages were given.
 */
public interface ExpoPushSender {

  List<PushResult> send(Collection<PushMessage> messages);

  record PushMessage(String to, String title, String body, Map<String, Object> data) {}

  /**
   * @param deviceNotRegistered Expo says this token is dead: stop using it
   * @param error short description when {@code ok} is false, else null
   */
  record PushResult(boolean ok, boolean deviceNotRegistered, String error) {}
}
