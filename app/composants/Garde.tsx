"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { sb } from "@/lib/supabase-browser";

/**
 * Renvoie vers la connexion si aucune session.
 *
 * Ce n'est qu'un confort d'affichage : la vraie protection est le Row
 * Level Security, qui empêche la base de renvoyer quoi que ce soit
 * sans session valide.
 */
export default function Garde({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [pret, setPret] = useState(false);

  useEffect(() => {
    sb.auth.getSession().then(({ data }) => {
      if (!data.session) router.replace("/");
      else setPret(true);
    });
    const { data: sub } = sb.auth.onAuthStateChange((_e, session) => {
      if (!session) router.replace("/");
    });
    return () => sub.subscription.unsubscribe();
  }, [router]);

  if (!pret) return null;
  return <>{children}</>;
}
