"use client";

import { useId, useState } from "react";
import { AudioWaveform, ChevronDown } from "lucide-react";
import type { TranscriptLine } from "@/lib/types";
import { formatCallDuration } from "@/lib/format";
import { cn } from "@/lib/cn";

function timestamp(t: number) {
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
}

interface TranscriptProps {
  lines: TranscriptLine[];
  clientName: string;
  durationSec: number;
}

/** Transcription dépliable, présentée comme une conversation chronologique. */
export function Transcript({ lines, clientName, durationSec }: TranscriptProps) {
  const [open, setOpen] = useState(false);
  const id = useId();

  return (
    <section className="border-t border-line px-5 py-4 sm:px-6">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={id}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <span>
          <span className="block text-xs font-semibold tracking-wide text-ink-muted uppercase">Transcription</span>
          <span className="mt-0.5 block text-[13px] text-ink-soft">
            {lines.length} échanges · {formatCallDuration(durationSec)}
          </span>
        </span>
        <span className="flex items-center gap-1 text-[13px] font-medium text-ink-soft">
          {open ? "Masquer" : "Afficher"}
          <ChevronDown aria-hidden className={cn("size-4 transition", open && "rotate-180")} />
        </span>
      </button>

      {open && (
        <ol id={id} className="mt-4 space-y-3">
          {lines.map((line, i) => {
            const astio = line.speaker === "astio";
            return (
              <li key={i} className={cn("flex gap-2.5", !astio && "flex-row-reverse")}>
                <span
                  aria-hidden
                  className={cn(
                    "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold",
                    astio ? "bg-brand-50 text-brand-700" : "bg-stone-100 text-ink-soft",
                  )}
                >
                  {astio ? <AudioWaveform className="size-3" /> : clientName.charAt(0)}
                </span>
                <div className={cn("max-w-[85%]", !astio && "text-right")}>
                  <p className="text-[11px] text-ink-muted">
                    <span className="font-medium text-ink-soft">{astio ? "Astio" : clientName}</span> ·{" "}
                    <span className="tabular-nums">{timestamp(line.t)}</span>
                  </p>
                  <p
                    className={cn(
                      "mt-0.5 inline-block rounded-xl px-3 py-2 text-left text-[13px] leading-relaxed",
                      astio ? "rounded-tl-sm bg-canvas text-ink" : "rounded-tr-sm bg-stone-100 text-ink",
                    )}
                  >
                    {line.text}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
