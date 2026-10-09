package com.avicare.tenancy.dto.response;

/**
 * Result of adding a member: the membership, and the one-time temporary password.
 *
 * <p>{@code temporaryPassword} is {@code null} when the address already belonged to an account —
 * that person keeps the password they already use, and was attached to this farm rather than
 * created. Callers must tell the two apart: showing nothing would look like the save failed.
 */
public record CreateMemberResult(MemberResponse member, String temporaryPassword) {

  /** Whether an account was created for this member, as opposed to an existing one attached. */
  public boolean accountWasCreated() {
    return temporaryPassword != null;
  }
}
