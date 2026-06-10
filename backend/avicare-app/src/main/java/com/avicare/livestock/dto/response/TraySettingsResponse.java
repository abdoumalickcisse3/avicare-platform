package com.avicare.livestock.dto.response;

/** A farm's tray parametrization (size + price), resolved across the 3 layers. */
public record TraySettingsResponse(int traySize, int trayPriceXof) {}
