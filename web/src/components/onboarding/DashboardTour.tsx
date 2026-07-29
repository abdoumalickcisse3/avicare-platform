"use client";

import { useEffect } from "react";
import { driver, type DriveStep } from "driver.js";
import "driver.js/dist/driver.css";
import "./dashboardTour.css";

/**
 * Guided dashboard tour (driver.js). Spotlights each key element with a titled
 * message while dimming the rest, launched after the welcome popup. French UI,
 * Jawdi palette (see dashboardTour.css). Element-less steps render a centered
 * popover for the intro/outro. Targets are stable anchors (data-tour markers +
 * app chrome) so a step never lands on a missing element.
 */
const STEPS: DriveStep[] = [
  {
    popover: {
      title: "Votre tableau de bord",
      description:
        "En 30 secondes, voici où tout se passe. Suivez le guide — vous pourrez toujours revenir.",
    },
  },
  {
    element: '[data-tour="overview"]',
    popover: {
      title: "Vue d'ensemble",
      description:
        "Vos indicateurs clés — cheptel, mortalité, ventes, dépenses — mis à jour en direct. Changez la période en haut à droite.",
      side: "bottom",
      align: "start",
    },
  },
  {
    element: '[data-tour="nav"]',
    popover: {
      title: "Vos modules",
      description:
        "Élevage, Stock, Commercial, Finance : tout est ici. Le menu s'adapte à votre ferme et à vos accès.",
      side: "right",
      align: "start",
    },
  },
  {
    element: "[data-app-chrome]",
    popover: {
      title: "Ferme et compte",
      description:
        "Votre ferme active et votre profil. Basculez de ferme et gérez votre compte depuis ici.",
      side: "bottom",
      align: "end",
    },
  },
  {
    popover: {
      title: "Bientôt : Jawdi IA",
      description:
        "Bientôt, l'assistant Jawdi IA préparera vos saisies et vous alertera automatiquement. En attendant, bonne gestion !",
    },
  },
];

export function DashboardTour({
  run,
  onDone,
}: {
  run: boolean;
  onDone: () => void;
}) {
  useEffect(() => {
    if (!run) return;
    const tour = driver({
      steps: STEPS,
      showProgress: true,
      progressText: "{{current}} / {{total}}",
      allowClose: true,
      overlayColor: "rgba(18, 43, 18, 0.55)",
      stagePadding: 6,
      stageRadius: 12,
      popoverClass: "jawdi-tour",
      nextBtnText: "Suivant",
      prevBtnText: "Retour",
      doneBtnText: "Terminer",
      onDestroyed: () => onDone(),
    });
    tour.drive();
    return () => tour.destroy();
    // onDone is stable (useCallback in the parent); run is the trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run]);

  return null;
}
