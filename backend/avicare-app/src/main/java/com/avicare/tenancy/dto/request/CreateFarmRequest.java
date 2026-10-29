package com.avicare.tenancy.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.util.List;

/** Farm creation payload. The caller becomes the farm OWNER. */
public record CreateFarmRequest(
    @NotBlank @Size(max = 200) String name,
    @Size(max = 2000) String description,
    @Size(max = 500) String location,
    BigDecimal gpsLatitude,
    BigDecimal gpsLongitude,
    Integer capacity,
    @Size(max = 50) String timezone,
    @Size(max = 3) String currency,
    /** Métier focus tokens (broiler/layer), Décision 17. Optional. */
    List<String> productionFocus,
    /**
     * Pays (ISO 3166-1 alpha-2), d'où découlent le fuseau et le libellé du champ fiscal.
     *
     * <p><b>Optionnel, et il doit le rester</b> : une app iOS déjà installée ne l'envoie pas, et la
     * lui refuser enfermerait dehors des gens qui n'ont rien demandé. Absent, le pays vaut `SN`.
     */
    @Size(max = 2) String country) {}
