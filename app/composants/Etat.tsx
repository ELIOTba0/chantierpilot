"use client";

/**
 * Rend visible ce qu'une requête a réellement renvoyé.
 *
 * Un écran vide peut vouloir dire deux choses opposées : « il n'y a
 * rien » ou « on vous refuse la lecture ». Les confondre coûte des
 * heures — c'est exactement ce qui s'est passé avec le compte
 * Supabase orphelin : zéro ligne, zéro erreur, zéro explication.
 */

export type ErreurPostgrest = {
  message: string;
  code?: string;
  details?: string | null;
} | null;

export function Erreur({ e }: { e: ErreurPostgrest }) {
  if (!e) return null;

  // 42501 = permission denied ; PGRST301 = jeton absent ou expiré.
  const rls = e.code === "42501" || e.code === "PGRST301";

  return (
    <div className="encart-erreur" role="alert">
      <div className="encart-erreur-titre">Lecture refusée par la base</div>
      <div className="encart-erreur-detail">
        {e.message}{e.code ? ` (${e.code})` : ""}
      </div>
      {e.details && <div className="encart-erreur-detail">{e.details}</div>}
      {rls && (
        <div style={{ marginTop: ".5rem" }}>
          Le compte connecté n&apos;est rattaché à aucun plombier, ou les
          droits de lecture manquent. À vérifier :{" "}
          <span className="code">select plombier_courant();</span>
        </div>
      )}
    </div>
  );
}

/**
 * S'affiche quand la requête a réussi mais n'a rien ramené, et
 * seulement hors production : en développement on veut savoir ce
 * qu'on a demandé ; en production le plombier veut juste « rien à
 * venir ».
 */
export function Vide({ indices }: { indices: string[] }) {
  if (process.env.NODE_ENV === "production" || indices.length === 0) return null;
  return (
    <div className="encart-info">
      <div className="encart-erreur-titre">0 ligne, sans erreur</div>
      <p style={{ margin: "0 0 .5rem" }}>
        La base a répondu <span className="code">[]</span>. Soit rien ne
        correspond, soit une politique RLS filtre en silence — un refus
        renvoie un tableau vide, pas une erreur.
      </p>
      {indices.map((i) => (
        <div key={i} className="encart-erreur-detail">· {i}</div>
      ))}
    </div>
  );
}
