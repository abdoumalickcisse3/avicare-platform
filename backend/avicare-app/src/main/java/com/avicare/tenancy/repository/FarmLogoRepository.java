package com.avicare.tenancy.repository;

import com.avicare.tenancy.domain.FarmLogo;
import java.time.LocalDateTime;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** Accès au logo d'une ferme. */
public interface FarmLogoRepository extends JpaRepository<FarmLogo, Long> {

  /**
   * Horodatage du logo sans descendre l'image.
   *
   * <p>C'est ce que lit chaque réponse « ferme » : savoir qu'un logo existe et quand il a changé
   * suffit au client pour l'afficher et pour invalider son cache. Les octets ne partent que
   * lorsqu'on les demande vraiment.
   */
  @Query("SELECT l.updatedAt FROM FarmLogo l WHERE l.farmId = :farmId")
  Optional<LocalDateTime> findUpdatedAt(@Param("farmId") Long farmId);
}
