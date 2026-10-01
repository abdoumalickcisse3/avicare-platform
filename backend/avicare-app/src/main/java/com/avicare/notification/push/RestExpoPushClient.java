package com.avicare.notification.push;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

/**
 * {@link ExpoPushSender} over Expo's HTTP API: {@code POST /--/api/v2/push/send} with an array of
 * up to 100 messages, answered by one ticket per message. The access token is optional (only needed
 * when "enhanced security" is switched on in the EAS dashboard) and is never logged.
 */
@Component
@Slf4j
public class RestExpoPushClient implements ExpoPushSender {

  /** Expo rejects a request carrying more messages than this. */
  static final int MAX_BATCH = 100;

  private final RestClient restClient;
  private final String accessToken;

  public RestExpoPushClient(
      RestClient.Builder builder,
      @Value("${expo.push.base-url:https://exp.host}") String baseUrl,
      @Value("${expo.push.access-token:}") String accessToken) {
    this.restClient = builder.baseUrl(baseUrl).build();
    this.accessToken = accessToken;
  }

  @Override
  public List<PushResult> send(Collection<PushMessage> messages) {
    List<PushMessage> all = List.copyOf(messages);
    List<PushResult> results = new ArrayList<>(all.size());
    for (int from = 0; from < all.size(); from += MAX_BATCH) {
      results.addAll(sendBatch(all.subList(from, Math.min(from + MAX_BATCH, all.size()))));
    }
    return results;
  }

  private List<PushResult> sendBatch(List<PushMessage> batch) {
    try {
      RestClient.RequestBodySpec request =
          restClient
              .post()
              .uri("/--/api/v2/push/send")
              .contentType(MediaType.APPLICATION_JSON)
              .accept(MediaType.APPLICATION_JSON);
      if (accessToken != null && !accessToken.isBlank()) {
        request.header("Authorization", "Bearer " + accessToken);
      }
      JsonNode reply =
          request
              .body(batch.stream().map(RestExpoPushClient::payload).toList())
              .retrieve()
              .body(JsonNode.class);
      JsonNode tickets = reply == null ? null : reply.get("data");
      List<PushResult> results = new ArrayList<>(batch.size());
      for (int i = 0; i < batch.size(); i++) {
        results.add(
            tickets != null && tickets.isArray() && i < tickets.size()
                ? toResult(tickets.get(i))
                : new PushResult(false, false, "No ticket returned"));
      }
      return results;
    } catch (RestClientResponseException e) {
      return failAll(batch, "HTTP " + e.getStatusCode().value());
    } catch (RuntimeException e) {
      log.warn("Expo push failed: {}", e.getMessage());
      return failAll(batch, e.getClass().getSimpleName() + ": " + e.getMessage());
    }
  }

  private static Map<String, Object> payload(PushMessage m) {
    Map<String, Object> body = new LinkedHashMap<>();
    body.put("to", m.to());
    body.put("title", m.title());
    body.put("body", m.body());
    body.put("sound", "default");
    body.put("priority", "high");
    body.put("data", m.data());
    return body;
  }

  private static PushResult toResult(JsonNode ticket) {
    if ("ok".equals(ticket.path("status").asText())) {
      return new PushResult(true, false, null);
    }
    boolean dead = "DeviceNotRegistered".equals(ticket.path("details").path("error").asText());
    return new PushResult(false, dead, ticket.path("message").asText("Expo rejected the message"));
  }

  private static List<PushResult> failAll(List<PushMessage> batch, String error) {
    return batch.stream().map(m -> new PushResult(false, false, error)).toList();
  }
}
