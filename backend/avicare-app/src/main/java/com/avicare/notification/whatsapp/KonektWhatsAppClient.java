package com.avicare.notification.whatsapp;

import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

/**
 * {@link WhatsAppSender} backed by the Konekt gateway (Sprint C1 Phase 2): {@code POST /send} with
 * header {@code X-WA-SECRET} and body {@code {phone, message}}. Never throws — every failure is
 * mapped to a {@link SendResult} so the dispatcher can retry. The secret is never logged.
 */
@Component
@Slf4j
public class KonektWhatsAppClient implements WhatsAppSender {

  private final RestClient restClient;
  private final String apiSecret;

  public KonektWhatsAppClient(
      RestClient.Builder builder,
      @Value("${konekt.base-url:https://konekt.nexteranga.com}") String baseUrl,
      @Value("${konekt.api-secret:}") String apiSecret) {
    this.restClient = builder.baseUrl(baseUrl).build();
    this.apiSecret = apiSecret;
  }

  @Override
  public SendResult send(String phone, String message) {
    try {
      ResponseEntity<String> resp =
          restClient
              .post()
              .uri("/send")
              .header("X-WA-SECRET", apiSecret)
              .contentType(MediaType.APPLICATION_JSON)
              .body(Map.of("phone", phone, "message", message))
              .retrieve()
              .toEntity(String.class);
      if (resp.getStatusCode().is2xxSuccessful()) {
        return SendResult.ok(resp.getBody());
      }
      return SendResult.failed("HTTP " + resp.getStatusCode().value(), resp.getBody());
    } catch (RestClientResponseException e) {
      return SendResult.failed("HTTP " + e.getStatusCode().value(), e.getResponseBodyAsString());
    } catch (RuntimeException e) {
      log.warn("Konekt send failed: {}", e.getMessage());
      return SendResult.failed(e.getClass().getSimpleName() + ": " + e.getMessage(), null);
    }
  }
}
