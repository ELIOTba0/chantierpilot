import type { ReactNode } from "react";

interface PanelSectionProps {
  title: string;
  id?: string;
  action?: ReactNode;
  children: ReactNode;
}

export function PanelSection({ title, id, action, children }: PanelSectionProps) {
  return (
    <section aria-labelledby={id} className="border-t border-line/70 px-5 py-5 sm:px-6">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 id={id} className="text-[15px] font-semibold text-ink">
          {title}
        </h3>
        {action}
      </div>
      {children}
    </section>
  );
}
