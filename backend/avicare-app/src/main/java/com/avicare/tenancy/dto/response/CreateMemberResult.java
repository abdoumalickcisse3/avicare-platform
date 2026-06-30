package com.avicare.tenancy.dto.response;

/** Result of provisioning a member: the membership + the one-time temporary password. */
public record CreateMemberResult(MemberResponse member, String temporaryPassword) {}
