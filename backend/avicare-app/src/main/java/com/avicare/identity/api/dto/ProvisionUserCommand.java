package com.avicare.identity.api.dto;

/** Command to provision a user account from another context (e.g. tenancy). */
public record ProvisionUserCommand(
    String fullName, String email, String phone, String rawPassword) {}
