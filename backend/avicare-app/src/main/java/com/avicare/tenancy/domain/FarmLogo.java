package com.avicare.tenancy.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDateTime;
import lombok.Getter;
import lombok.Setter;

/**
 * Le logo d'une ferme, dans sa propre table.
 *
 * <p>Séparé de {@link Farm} à dessein : sans amélioration du bytecode, Hibernate charge toutes les
 * colonnes simples d'une entité. Porté par {@code farms}, l'image descendrait à chaque lecture de
 * ferme — jusque dans le sélecteur de ferme, qui en liste plusieurs.
 *
 * <p>La clé primaire EST la clé étrangère : une ferme a au plus un logo, et la suppression de la
 * ferme emporte le sien.
 */
@Entity
@Table(name = "farm_logos")
@Getter
@Setter
public class FarmLogo {

  @Id
  @Column(name = "farm_id")
  private Long farmId;

  /** Les octets de l'image, déjà redimensionnée à l'entrée. */
  @Column(nullable = false)
  private byte[] image;

  /** {@code image/png} ou {@code image/jpeg} — la base le vérifie aussi. */
  @Column(name = "content_type", nullable = false)
  private String contentType;

  @Column(name = "created_at", insertable = false, updatable = false)
  private LocalDateTime createdAt;

  /** Posé par le trigger. Sert de jeton de cache aux clients. */
  @Column(name = "updated_at", insertable = false, updatable = false)
  private LocalDateTime updatedAt;
}
