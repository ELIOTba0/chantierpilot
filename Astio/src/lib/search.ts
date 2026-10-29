/** Normalise une chaîne pour une recherche insensible à la casse et aux accents. */
export function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}
