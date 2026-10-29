"use client";

import { useEffect, useRef, type ReactNode } from "react";

interface SideSheetProps {
  open: boolean;
  onClose: () => void;
  labelledBy: string;
  children: ReactNode;
}

/**
 * Panneau latéral modal (élément natif <dialog>) : occupe tout l'écran sur
 * mobile et s'ouvre à droite sur ordinateur.
 */
export function SideSheet({ open, onClose, labelledBy, children }: SideSheetProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      // L'événement close d'une boîte de dialogue imbriquée ne doit pas fermer le panneau.
      onClose={(e) => e.target === e.currentTarget && onClose()}
      onClick={(e) => e.target === ref.current && onClose()}
      aria-labelledby={labelledBy}
      className="fixed inset-y-0 right-0 left-auto m-0 h-dvh max-h-none w-full max-w-none overflow-hidden border-0 bg-transparent p-0 backdrop:bg-ink/25 sm:w-[min(40rem,92vw)]"
    >
      {open && (
        <div className="flex h-full animate-[panel-in_180ms_ease-out] flex-col bg-surface shadow-(--shadow-pop) sm:rounded-l-2xl">
          {children}
        </div>
      )}
    </dialog>
  );
}
