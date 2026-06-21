import { redirect } from "next/navigation";

/** The commercial area has no landing page; go straight to the orders worklist. */
export default function CommercialIndexPage() {
  redirect("/commercial/commandes");
}
