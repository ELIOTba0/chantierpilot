import { AudioWaveform } from "lucide-react";

export function Logo() {
  return (
    <span className="flex items-center gap-2.5">
      <span className="bg-brand-gradient flex size-8 items-center justify-center rounded-lg shadow-sm">
        <AudioWaveform aria-hidden className="size-[18px] text-ink" strokeWidth={2.25} />
      </span>
      <span className="text-[17px] font-semibold tracking-tight text-ink">Astio</span>
    </span>
  );
}
