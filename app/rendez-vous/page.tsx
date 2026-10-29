"use client";

import Link from "next/link";
import Entete from "../composants/Entete";
import Garde from "../composants/Garde";
import ListeRendezVous from "../composants/ListeRendezVous";
import { TetePage } from "../composants/Ui";

export default function RendezVous() {
  return (
    <Garde>
      <Entete />
      <main className="page">
        <TetePage titre="Rendez-vous"
                  sousTitre="Les interventions prises par l'assistant et celles que vous avez saisies.">
          <Link className="bouton" href="/agenda">Vue calendrier</Link>
          <Link className="bouton" data-style="plein" href="/rendez-vous/nouveau">Ajouter un rendez-vous</Link>
        </TetePage>
        <ListeRendezVous baseAppels="/appels" baseDemandes="/demandes" />
      </main>
    </Garde>
  );
}
