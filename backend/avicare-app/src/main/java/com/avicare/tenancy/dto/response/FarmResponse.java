package com.avicare.tenancy.dto.response;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

/**
 * HTTP view of a farm. {@code productionFocus} is the métier focus (broiler/layer), Décision 17.
 *
 * <p>{@code ninea} et {@code rccm} existent en base depuis V1 sans avoir jamais été exposés : ils
 * figurent sur la facture que l'éleveur remet à son client, qui en a besoin pour sa comptabilité.
 *
 * <p>Le logo ne voyage pas ici — seulement {@code logoUpdatedAt}, nul quand il n'y en a pas. Savoir
 * qu'un logo existe et quand il a changé suffit au client pour l'afficher et pour invalider son
 * cache ; descendre les octets à chaque lecture de ferme coûterait cher pour rien.
 */
public record FarmResponse(
    Long id,
    String name,
    String description,
    String location,
    BigDecimal gpsLatitude,
    BigDecimal gpsLongitude,
    Integer capacity,
    String timezone,
    String currency,
    Long createdBy,
    boolean active,
    LocalDateTime createdAt,
    List<String> productionFocus,
    String ninea,
    String rccm,
    LocalDateTime logoUpdatedAt) {}
