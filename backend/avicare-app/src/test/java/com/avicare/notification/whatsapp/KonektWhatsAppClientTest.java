package com.avicare.notification.whatsapp;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.content;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withServerError;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import com.avicare.notification.whatsapp.WhatsAppSender.SendResult;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

class KonektWhatsAppClientTest {

  private KonektWhatsAppClient client(MockRestServiceServer[] serverOut) {
    RestClient.Builder builder = RestClient.builder();
    serverOut[0] = MockRestServiceServer.bindTo(builder).build();
    return new KonektWhatsAppClient(builder, "https://konekt.test", "SECRET123");
  }

  @Test
  void send_postsToKonekt_withSecretHeaderAndBody_onSuccess() {
    MockRestServiceServer[] holder = new MockRestServiceServer[1];
    KonektWhatsAppClient sut = client(holder);
    holder[0]
        .expect(requestTo("https://konekt.test/send"))
        .andExpect(method(HttpMethod.POST))
        .andExpect(header("X-WA-SECRET", "SECRET123"))
        .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
        .andExpect(
            content().string(org.hamcrest.Matchers.containsString("\"phone\":\"221770000000\"")))
        .andRespond(withSuccess("{\"message\":\"queued\"}", MediaType.APPLICATION_JSON));

    SendResult result = sut.send("221770000000", "Alerte mortalité");

    assertThat(result.ok()).isTrue();
    assertThat(result.rawResponse()).contains("queued");
    holder[0].verify();
  }

  @Test
  void send_returnsFailed_onServerError_withoutThrowing() {
    MockRestServiceServer[] holder = new MockRestServiceServer[1];
    KonektWhatsAppClient sut = client(holder);
    holder[0].expect(requestTo("https://konekt.test/send")).andRespond(withServerError());

    SendResult result = sut.send("221770000000", "Alerte");

    assertThat(result.ok()).isFalse();
    assertThat(result.error()).contains("500");
  }
}
