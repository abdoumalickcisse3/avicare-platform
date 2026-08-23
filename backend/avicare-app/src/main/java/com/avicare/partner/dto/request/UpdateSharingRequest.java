package com.avicare.partner.dto.request;

/** Farmer sets the five sharing sliders for a membership. */
public record UpdateSharingRequest(
    boolean activity,
    boolean flockHealth,
    boolean feedConsumption,
    boolean salesVolume,
    boolean finances) {}
