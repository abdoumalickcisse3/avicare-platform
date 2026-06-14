package com.avicare.livestock.inventory;

import com.avicare.livestock.domain.ArticleSource;
import java.math.BigDecimal;

/**
 * Optional stock consumption attached to a source action (Sprint B4-5, Décision D18). When present
 * on a DailyRecord / Vaccination / Treatment command, it triggers an automatic {@code OUT} stock
 * movement for {@code quantity} of {@code articleKey}. When absent (null), the source action
 * behaves exactly as before (no coupling).
 */
public record StockConsumption(
    String articleKey, ArticleSource articleSource, BigDecimal quantity, String notes) {}
