/**
 * Base Adresse Nationale — référentiel officiel des adresses
 * françaises, publié en open data. Gratuit, sans clé.
 *
 * Partagé entre la vérification pendant l'appel et le géocodage au
 * moment de la réservation, pour que les deux appliquent exactement
 * les mêmes règles.
 */

export type TraitBAN = {
  label: string;
  score: number;
  housenumber?: string;
  street?: string;
  postcode: string;
  city: string;
  type: string;
  lat?: number;
  lon?: number;
};

export async function interrogerBAN(
  requete: string,
  limite = 8
): Promise<TraitBAN[]> {
  const url = new URL("https://api-adresse.data.gouv.fr/search/");
  url.searchParams.set("q", requete);
  url.searchParams.set("limit", String(limite));
  url.searchParams.set("autocomplete", "0");

  const r = await fetch(url, { signal: AbortSignal.timeout(6000) });
  if (!r.ok) throw new Error(`BAN a répondu ${r.status}`);

  const data = await r.json();
  return ((data.features ?? []) as Array<{
    properties: Omit<TraitBAN, "lat" | "lon">;
    geometry?: { coordinates?: [number, number] };
  }>).map((f) => ({
    ...f.properties,
    // GeoJSON donne [longitude, latitude], dans cet ordre.
    lon: f.geometry?.coordinates?.[0],
    lat: f.geometry?.coordinates?.[1],
  }));
}

/**
 * Coordonnées d'une adresse, ou null si on n'est pas sûr.
 *
 * Mieux vaut pas de carte qu'une carte qui pointe ailleurs : on
 * n'accepte qu'un résultat de bon score, dans la bonne commune.
 */
export async function coordonnees(
  adresse: string,
  commune: string | null,
  normaliser: (v: string) => string
): Promise<{ lat: number; lon: number } | null> {
  try {
    const traits = await interrogerBAN(
      commune ? `${adresse} ${commune}` : adresse,
      3
    );
    const t = traits.find((x) => {
      if (x.score < 0.7 || x.lat == null || x.lon == null) return false;
      if (commune && normaliser(x.city) !== normaliser(commune)) return false;
      return true;
    });
    return t ? { lat: t.lat!, lon: t.lon! } : null;
  } catch {
    return null;
  }
}
