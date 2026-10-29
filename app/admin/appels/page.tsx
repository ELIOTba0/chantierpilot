"use client";

import Entete from "../../composants/Entete";
import Garde from "../../composants/Garde";
import ListeAppels from "../../composants/ListeAppels";
import { TetePage } from "../../composants/Ui";

export default function AppelsAdmin() {
  return (
    <Garde espace="admin">
      <Entete />
      <main className="page">
        <TetePage titre="Appels" sousTitre="Les appels de toutes les entreprises clientes." />
        <ListeAppels base="/admin/appels" admin />
      </main>
    </Garde>
  );
}
