import { BreedLibraryView } from "@/components/settings/BreedLibraryView";

/**
 * Breed declaration settings (Tâche 6, spec souches-locales-ameliorees): lets a farm add a breed
 * the platform catalogue does not have. A dedicated route takes precedence over the generic
 * [category] placeholder.
 */
export default function BreedLibraryPage() {
  return <BreedLibraryView />;
}
