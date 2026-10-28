import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <section className={cn("rounded-xl border border-line bg-surface shadow-(--shadow-card)", className)}>
      {children}
    </section>
  );
}

interface CardHeaderProps {
  title: string;
  description?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  id?: string;
}

export function CardHeader({ title, description, icon, action, id }: CardHeaderProps) {
  return (
    <header className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
      <div className="flex min-w-0 items-start gap-3">
        {icon && <span className="mt-0.5 text-ink-muted">{icon}</span>}
        <div className="min-w-0">
          <h2 id={id} className="text-[15px] font-semibold tracking-tight text-ink">
            {title}
          </h2>
          {description && <p className="mt-0.5 text-[13px] text-ink-muted">{description}</p>}
        </div>
      </div>
      {action}
    </header>
  );
}
