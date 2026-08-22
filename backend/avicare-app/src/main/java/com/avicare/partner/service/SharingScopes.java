package com.avicare.partner.service;

/** Farmer-controlled sharing sliders for a partner membership. */
public record SharingScopes(
    boolean activity,
    boolean flockHealth,
    boolean feedConsumption,
    boolean salesVolume,
    boolean finances) {}
