package com.avicare.integrity.dto;

import com.avicare.common.api.response.PageResponse;

/** The screen's header: how bad is it, and since when. */
public record IntegritySummary(
    long critical, long warning, long info, PageResponse<FindingRow> findings) {}
