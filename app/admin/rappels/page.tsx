"use client";

import Entete from "../../composants/Entete";
import Garde from "../../composants/Garde";
import ListeRappels from "../../composants/ListeRappels";
import { TetePage } from "../../composants/Ui";

export default function RappelsAdmin() {
  return (
    <Garde espace="admin">
      <Entete />
      <main className="page">
        <TetePage titre="Rappels" sousTitre="Les rappels de toutes les entreprises, en retard et prioritaires d'abord." />
        <ListeRappels baseAppels="/admin/appels" admin />
      </main>
    </Garde>
  );
}
