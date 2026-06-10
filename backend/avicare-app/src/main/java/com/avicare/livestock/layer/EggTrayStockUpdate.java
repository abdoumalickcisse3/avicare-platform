package com.avicare.livestock.layer;

/** Command to set a farm's tray stock to exact values (both must be &gt;= 0). */
public record EggTrayStockUpdate(int fullTraysCount, int emptyTraysCount) {}
