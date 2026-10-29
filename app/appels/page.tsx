"use client";

import Entete from "../composants/Entete";
import Garde from "../composants/Garde";
import ListeAppels from "../composants/ListeAppels";
import { TetePage } from "../composants/Ui";

export default function Appels() {
  return (
    <Garde>
      <Entete />
      <main className="page">
        <TetePage titre="Appels"
                  sousTitre="Les appels reçus par votre assistant. Par défaut, les 7 derniers jours ; l'historique complet reste accessible avec le filtre Période." />
        <ListeAppels base="/appels" />
      </main>
    </Garde>
  );
}
