package com.avicare.livestock.dto.request;

/** Apply signed deltas to a farm's tray stock (negative results are rejected by the service). */
public record TrayStockAdjustRequest(int fullDelta, int emptyDelta) {}
