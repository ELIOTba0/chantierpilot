"use client";

import { useParams } from "next/navigation";
import DetailAppel from "../../composants/DetailAppel";
import Entete from "../../composants/Entete";
import Garde from "../../composants/Garde";

export default function PageAppel() {
  const { id } = useParams<{ id: string }>();
  return (
    <Garde>
      <Entete />
      <DetailAppel id={id} retour={{ href: "/appels", libelle: "Tous les appels" }}
                   baseRappels="/rappels" baseDemandes="/demandes" />
    </Garde>
  );
}
