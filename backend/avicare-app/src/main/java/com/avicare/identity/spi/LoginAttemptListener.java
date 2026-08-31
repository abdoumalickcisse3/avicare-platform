package com.avicare.identity.spi;

/**
 * Port letting something watch how sign-in attempts go, without identity knowing who is watching.
 *
 * <p>Declared here and implemented by the threat context, the way the gating and integrity contexts
 * declare their own ports. Authentication should not have to import a detector, and the detector
 * should not have to guess at outcomes by parsing HTTP responses — the failure is known precisely
 * here, along with the address that was typed.
 *
 * <p>Implementations must never throw: a detector that breaks sign-in is a worse outage than the
 * attack it watches for.
 */
public interface LoginAttemptListener {

  /** A sign-in that did not succeed, whatever the reason. */
  void loginFailed(String email);

  /** An account was created. */
  void accountCreated(String email);
}
