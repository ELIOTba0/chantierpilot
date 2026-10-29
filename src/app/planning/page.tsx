import { redirect } from "next/navigation";

/** L'ancien onglet Planning est fusionné dans la vue d'ensemble. */
export default function PlanningPage() {
  redirect("/");
}
