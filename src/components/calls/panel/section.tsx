import type { ReactNode } from "react";

interface PanelSectionProps {
  title: string;
  id?: string;
  action?: ReactNode;
  children: ReactNode;
}

export function PanelSection({ title, id, action, children }: PanelSectionProps) {
  return (
    <section aria-labelledby={id} className="border-t border-line px-5 py-5 sm:px-6">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 id={id} className="text-xs font-semibold tracking-wide text-ink-muted uppercase">
          {title}
        </h3>
        {action}
      </div>
      {children}
    </section>
  );
}
