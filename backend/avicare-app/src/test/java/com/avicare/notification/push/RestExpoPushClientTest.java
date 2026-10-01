package com.avicare.notification.push;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.client.ExpectedCount.times;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.content;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.jsonPath;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withServerError;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import com.avicare.notification.push.ExpoPushSender.PushMessage;
import com.avicare.notification.push.ExpoPushSender.PushResult;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

class RestExpoPushClientTest {

  private static final String URL = "https://expo.test/--/api/v2/push/send";

  private RestExpoPushClient client(MockRestServiceServer[] out, String accessToken) {
    RestClient.Builder builder = RestClient.builder();
    out[0] = MockRestServiceServer.bindTo(builder).build();
    return new RestExpoPushClient(builder, "https://expo.test", accessToken);
  }

  private static PushMessage msg(String token) {
    return new PushMessage(token, "Stock bas", "Ferme Test", Map.of("notificationId", 7));
  }

  @Test
  void send_postsABatchAndMapsEachTicketToItsMessage() {
    MockRestServiceServer[] holder = new MockRestServiceServer[1];
    RestExpoPushClient sut = client(holder, "");
    holder[0]
        .expect(requestTo(URL))
        .andExpect(method(HttpMethod.POST))
        .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
        .andExpect(jsonPath("$[0].to").value("ExponentPushToken[a]"))
        .andExpect(jsonPath("$[0].title").value("Stock bas"))
        .andExpect(jsonPath("$[0].body").value("Ferme Test"))
        .andExpect(jsonPath("$[0].sound").value("default"))
        .andExpect(jsonPath("$[0].data.notificationId").value(7))
        .andExpect(jsonPath("$[1].to").value("ExponentPushToken[b]"))
        .andRespond(
            withSuccess(
                """
                {"data":[{"status":"ok","id":"1"},
                         {"status":"error","message":"gone",
                          "details":{"error":"DeviceNotRegistered"}}]}
                """,
                MediaType.APPLICATION_JSON));

    List<PushResult> results =
        sut.send(List.of(msg("ExponentPushToken[a]"), msg("ExponentPushToken[b]")));

    assertThat(results).hasSize(2);
    assertThat(results.get(0).ok()).isTrue();
    assertThat(results.get(1).ok()).isFalse();
    assertThat(results.get(1).deviceNotRegistered()).isTrue();
    holder[0].verify();
  }

  @Test
  void send_sendsTheAccessTokenWhenConfigured() {
    MockRestServiceServer[] holder = new MockRestServiceServer[1];
    RestExpoPushClient sut = client(holder, "SECRET");
    holder[0]
        .expect(requestTo(URL))
        .andExpect(header("Authorization", "Bearer SECRET"))
        .andRespond(withSuccess("{\"data\":[{\"status\":\"ok\"}]}", MediaType.APPLICATION_JSON));

    sut.send(List.of(msg("ExponentPushToken[a]")));

    holder[0].verify();
  }

  @Test
  void send_failsEveryMessageWithoutThrowing_whenExpoIsDown() {
    MockRestServiceServer[] holder = new MockRestServiceServer[1];
    RestExpoPushClient sut = client(holder, "");
    holder[0].expect(requestTo(URL)).andRespond(withServerError());

    List<PushResult> results = sut.send(List.of(msg("ExponentPushToken[a]")));

    assertThat(results).hasSize(1);
    assertThat(results.get(0).ok()).isFalse();
    assertThat(results.get(0).deviceNotRegistered()).isFalse();
    assertThat(results.get(0).error()).contains("500");
  }

  @Test
  void send_splitsBatchesAtTheHundredMessageLimit() {
    MockRestServiceServer[] holder = new MockRestServiceServer[1];
    RestExpoPushClient sut = client(holder, "");
    String hundredOk = "{\"data\":[" + "{\"status\":\"ok\"},".repeat(99) + "{\"status\":\"ok\"}]}";
    holder[0]
        .expect(times(2), requestTo(URL))
        .andRespond(withSuccess(hundredOk, MediaType.APPLICATION_JSON));
    List<PushMessage> many = new ArrayList<>();
    for (int i = 0; i < 100; i++) many.add(msg("ExponentPushToken[" + i + "]"));

    // 100 fit in one request; the 101st starts a second one.
    many.add(msg("ExponentPushToken[100]"));
    List<PushResult> results = sut.send(many);

    assertThat(results).hasSize(101);
    holder[0].verify();
  }

  @Test
  void send_ofNothing_doesNotCallExpo() {
    MockRestServiceServer[] holder = new MockRestServiceServer[1];
    RestExpoPushClient sut = client(holder, "");

    assertThat(sut.send(List.of())).isEmpty();
    holder[0].verify();
  }
}
