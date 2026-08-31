package com.avicare.common.api.web;

import jakarta.servlet.http.HttpServletRequest;

/**
 * The caller's address as seen from outside the reverse proxy.
 *
 * <p>Caddy sits in front in production, so {@code getRemoteAddr()} is the proxy, not the client,
 * and the real address is the first hop of {@code X-Forwarded-For}. Three places needed this — the
 * audit trail, the request traces, and now the security filters — and three copies of the same four
 * lines is how they start disagreeing.
 *
 * <p><b>What this is not.</b> {@code X-Forwarded-For} is a header, and a header can be forged by
 * whoever sends the request. It is trustworthy here only because Caddy overwrites it and nothing
 * but Caddy can reach the backend (the container is not published outside the internal network). If
 * the backend ever becomes directly reachable, an attacker can spoof this value — and the IP
 * blocking built on it stops meaning anything. That is a deployment invariant, not a code one.
 */
public final class ClientIp {

  private ClientIp() {}

  /** Never null in a servlet request; falls back to the socket address. */
  public static String of(HttpServletRequest request) {
    String forwarded = request.getHeader("X-Forwarded-For");
    if (forwarded != null && !forwarded.isBlank()) {
      return forwarded.split(",")[0].trim();
    }
    return request.getRemoteAddr();
  }
}
