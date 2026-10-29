"use client";

/**
 * Ce qu'on affiche pendant que la base répond.
 *
 * Une page blanche pendant une seconde donne l'impression que rien
 * ne se passe, ou que l'application a planté. Un squelette montre la
 * forme de ce qui arrive : l'attente paraît plus courte, et rien ne
 * saute quand les données se posent.
 */

function Barre({ l, h = 14, mb = 10 }: { l: string; h?: number; mb?: number }) {
  return (
    <div className="squelette" style={{ width: l, height: h, marginBottom: mb }} />
  );
}

export default function Squelette({ variante = "liste" }: { variante?: "liste" | "fiche" | "formulaire" }) {
  if (variante === "fiche") {
    return (
      <main className="page" aria-busy="true" aria-label="Chargement">
        <Barre l="8rem" h={18} mb={22} />
        <Barre l="14rem" h={30} mb={10} />
        <Barre l="20rem" h={16} mb={36} />
        <div className="colonnes">
          <div className="colonne-large">
            <Barre l="6rem" h={12} mb={14} />
            <Barre l="100%" h={16} />
            <Barre l="92%" h={16} />
            <Barre l="70%" h={16} mb={36} />
            <Barre l="6rem" h={12} mb={14} />
            <Barre l="100%" h={16} />
            <Barre l="84%" h={16} />
          </div>
          <aside className="colonne-cote">
            <div className="squelette" style={{ width: "100%", height: 260, borderRadius: 14 }} />
          </aside>
        </div>
      </main>
    );
  }

  if (variante === "formulaire") {
    return (
      <main className="page" aria-busy="true" aria-label="Chargement">
        <Barre l="10rem" h={30} mb={28} />
        <div className="colonnes">
          <div style={{ flex: "0 1 236px" }}>
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <Barre key={i} l="100%" h={40} mb={6} />
            ))}
          </div>
          <div className="colonne-large">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} style={{ display: "flex", gap: 24, padding: "18px 0",
                                    borderTop: "1px solid var(--line)" }}>
                <Barre l="150px" h={16} mb={0} />
                <Barre l="60%" h={44} mb={0} />
              </div>
            ))}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="page" aria-busy="true" aria-label="Chargement">
      <Barre l="16rem" h={30} mb={10} />
      <Barre l="24rem" h={16} mb={36} />
      <div className="colonnes">
        <div className="colonne-large">
          <div className="squelette" style={{ width: "100%", height: 230, borderRadius: 14,
                                              marginBottom: 40 }} />
          <Barre l="6rem" h={12} mb={16} />
          {[0, 1, 2, 3].map((i) => (
            <div key={i} style={{ display: "flex", gap: 24, padding: "20px 8px",
                                  borderTop: "1px solid var(--line)" }}>
              <Barre l="62px" h={18} mb={0} />
              <div style={{ flex: 1 }}>
                <Barre l="40%" h={15} mb={8} />
                <Barre l="65%" h={13} mb={0} />
              </div>
            </div>
          ))}
        </div>
        <aside className="colonne-cote">
          <Barre l="6rem" h={12} mb={16} />
          <Barre l="100%" h={15} />
          <Barre l="80%" h={13} mb={28} />
          <Barre l="100%" h={15} />
          <Barre l="70%" h={13} />
        </aside>
      </div>
    </main>
  );
}
