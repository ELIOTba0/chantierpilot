"use client";

import Entete from "../../composants/Entete";
import Garde from "../../composants/Garde";
import ListeRendezVous from "../../composants/ListeRendezVous";
import { TetePage } from "../../composants/Ui";

export default function RendezVousAdmin() {
  return (
    <Garde espace="admin">
      <Entete />
      <main className="page">
        <TetePage titre="Rendez-vous" sousTitre="Les rendez-vous de toutes les entreprises clientes." />
        <ListeRendezVous baseAppels="/admin/appels" admin />
      </main>
    </Garde>
  );
}
