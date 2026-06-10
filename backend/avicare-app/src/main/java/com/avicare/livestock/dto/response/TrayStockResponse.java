package com.avicare.livestock.dto.response;

import java.time.LocalDateTime;

/** A farm's egg tray stock as returned by the API. */
public record TrayStockResponse(
    Long farmId, int fullTraysCount, int emptyTraysCount, LocalDateTime updatedAt) {}
