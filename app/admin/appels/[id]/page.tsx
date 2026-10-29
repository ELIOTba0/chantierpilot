"use client";

import { useParams } from "next/navigation";
import DetailAppel from "../../../composants/DetailAppel";
import Entete from "../../../composants/Entete";
import Garde from "../../../composants/Garde";

export default function AppelAdmin() {
  const { id } = useParams<{ id: string }>();
  return (
    <Garde espace="admin">
      <Entete />
      <DetailAppel id={id} admin retour={{ href: "/admin/appels", libelle: "Tous les appels" }}
                   baseRappels="/admin/rappels" />
    </Garde>
  );
}
