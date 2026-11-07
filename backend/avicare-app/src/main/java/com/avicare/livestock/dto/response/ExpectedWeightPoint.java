package com.avicare.livestock.dto.response;

/** One point of the server-computed growth reference curve, in grams at a given age in days. */
public record ExpectedWeightPoint(int ageDays, int weightG) {}
