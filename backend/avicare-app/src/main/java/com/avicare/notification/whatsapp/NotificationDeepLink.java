package com.avicare.notification.whatsapp;

import com.avicare.notification.domain.Notification;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Turns a notification's {@code sourceRef} into a web address, so a WhatsApp message can carry the
 * one thing it was missing: a way to act on it.
 *
 * <p>Both apps already route a notification to its screen from the same payload ({@code
 * NotificationBell.hrefFor} on the web, {@code notifications.tsx} on the phone). The message did
 * not — it said a lot was dying and left the reader to go find it. This mirrors the web routing
 * deliberately, path for path: a link that lands somewhere different from the bell would teach
 * people that the two disagree.
 *
 * <p>The web, not the mobile app: a WhatsApp message can only carry a URL, and the phone's routes
 * are internal. A farmer reading on WhatsApp taps through to the browser.
 *
 * <p>No link when the base URL is not configured — a bare path in a message is worse than no link
 * at all, and this must never be guessed from a request that does not exist here (the scan runs on
 * a scheduler, not on an HTTP thread).
 */
@Component
public class NotificationDeepLink {

  private final String baseUrl;

  public NotificationDeepLink(@Value("${notifications.app-url:}") String appUrl) {
    // Trailing slash trimmed once, here, so every caller can concatenate a path safely.
    this.baseUrl = appUrl == null ? "" : appUrl.trim().replaceAll("/+$", "");
  }

  /** The address to act on this notification, or {@code null} when there is nothing to link to. */
  public String urlFor(Notification n) {
    if (baseUrl.isEmpty()) {
      return null;
    }
    String path = pathFor(n.getSourceRef());
    return path == null ? null : baseUrl + path;
  }

  /** Mirrors the web bell's {@code hrefFor}, in the same order. */
  private static String pathFor(Map<String, Object> ref) {
    if (ref == null || ref.isEmpty()) {
      return null;
    }
    if (ref.get("unitId") instanceof Number id) {
      return "/elevage/lots/" + id.longValue();
    }
    if (ref.containsKey("purchaseOrderId")) {
      return "/stocks/achats";
    }
    if (ref.containsKey("itemId")) {
      return "/stocks";
    }
    if (ref.containsKey("invoiceId")) {
      return "/commercial/factures";
    }
    if (ref.containsKey("clientId")) {
      return "/commercial/clients";
    }
    return null;
  }
}
