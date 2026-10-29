"use client";

import Entete from "../composants/Entete";
import Garde from "../composants/Garde";
import ListeRappels from "../composants/ListeRappels";
import { TetePage } from "../composants/Ui";

export default function Rappels() {
  return (
    <Garde>
      <Entete />
      <main className="page">
        <TetePage titre="À rappeler"
                  sousTitre="Les personnes que l'assistant n'a pas pu satisfaire au téléphone. Les rappels en retard et prioritaires sont en tête." />
        <ListeRappels baseAppels="/appels" />
      </main>
    </Garde>
  );
}
