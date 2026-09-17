"use client";

import { useEffect, useRef } from "react";

import ConnectomeCanvas from "@/components/ConnectomeCanvas";
import { Activity, BrainPhase } from "@/lib/types";

interface BrainActivityPanelProps {
  phase: BrainPhase;
  /** Telemetry from the most recent fly move, or null before the first one. */
  activity: Activity | null;
  /** Per-column confidence from the last move, one entry per column. */
  scores: number[] | null;
  /** The column the fly actually played, highlighted in the list. */
  flyColumn: number | null;
  /** Identifier of the policy that produced the last move. */
  model: string | null;
}

const LEGEND: { label: string; color: string }[] = [
  { label: "optic lobe", color: "var(--color-optic)" },
  { label: "central brain", color: "var(--color-central)" },
  { label: "sensory in (the board)", color: "var(--color-sensory)" },
  { label: "motor out (the move)", color: "var(--color-motor)" },
];

const COUNT_UP_MS = 520;

/**
 * One telemetry number.
 *
 * The count-up writes straight to the DOM node instead of going through state:
 * a per-frame setState here would re-render the whole panel sixty times a
 * second for a purely visual effect.
 */
function Stat({
  label,
  value,
  suffix = "",
  pending,
}: {
  label: string;
  value: number | null;
  suffix?: string;
  pending: boolean;
}) {
  const nodeRef = useRef<HTMLDivElement | null>(null);
  const fromRef = useRef(0);

  useEffect(() => {
    const node = nodeRef.current;
    if (!node) return;

    if (value === null) {
      node.textContent = "\u2014";
      fromRef.current = 0;
      return;
    }

    const from = fromRef.current;
    const start = performance.now();
    let raf = 0;

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / COUNT_UP_MS);
      const eased = 1 - (1 - t) ** 3; // easeOutCubic
      const current = Math.round(from + (value - from) * eased);
      node.textContent = `${current.toLocaleString()}${suffix}`;

      if (t < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        fromRef.current = value;
      }
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, suffix]);

  return (
    <div className="px-3 py-2.5">
      <div
        ref={nodeRef}
        className={`font-mono text-[19px] leading-tight tabular-nums transition-colors ${
          pending ? "text-dim/50" : "text-slate-100"
        }`}
      >
        {"\u2014"}
      </div>
      <div className="label-caps mt-1 text-[9px] text-muted">{label}</div>
    </div>
  );
}

/** Per-column confidence, the closest thing the UI has to the fly's reasoning. */
function ScoreList({
  scores,
  flyColumn,
}: {
  scores: number[] | null;
  flyColumn: number | null;
}) {
  if (!scores) {
    return (
      <p className="px-4 py-3 text-[11px] text-muted">
        Column scores appear here once the fly has moved.
      </p>
    );
  }

  const ranked = scores
    .map((score, column) => ({ score, column }))
    .sort((a, b) => b.score - a.score);

  return (
    <div className="space-y-1 px-4 py-3">
      {ranked.map(({ score, column }) => {
        const chosen = column === flyColumn;
        return (
          <div key={column} className="flex items-center gap-2.5">
            <span
              className={`w-10 shrink-0 font-mono text-[11px] ${
                chosen ? "text-chip-fly" : "text-dim"
              }`}
            >
              col {column + 1}
            </span>
            <span className="h-1 flex-1 overflow-hidden rounded-full bg-edge/60">
              <span
                className={`block h-full rounded-full transition-[width] duration-500 ${
                  chosen ? "bg-chip-fly" : "bg-edge-bright"
                }`}
                style={{ width: `${Math.max(2, score * 100)}%` }}
              />
            </span>
            <span
              className={`w-9 shrink-0 text-right font-mono text-[11px] tabular-nums ${
                chosen ? "text-chip-fly" : "text-muted"
              }`}
            >
              {score.toFixed(2)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default function BrainActivityPanel({
  phase,
  activity,
  scores,
  flyColumn,
  model,
}: BrainActivityPanelProps) {
  const thinking = phase === "thinking";

  return (
    <section
      aria-label="Fruit fly connectome live activity"
      className="panel flex h-full flex-col overflow-hidden"
    >
      <header className="flex items-center justify-between gap-3 border-b border-edge/80 px-4 py-3">
        <h2 className="label-caps text-[10px] text-dim sm:text-[11px]">
          Fruit Fly Connectome <span className="text-muted">·</span> Live Activity
        </h2>

        <span
          className={`
            flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-1
            font-mono text-[10px] tracking-widest
            ${
              thinking
                ? "border-motor/50 bg-motor/10 text-motor"
                : "border-edge bg-panel-soft text-muted"
            }
          `}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              thinking ? "bg-motor animate-live-blink" : "bg-muted"
            }`}
          />
          {thinking ? "LIVE" : "IDLE"}
        </span>
      </header>

      {/* Visualisation */}
      <div className="relative min-h-[260px] flex-1 bg-void sm:min-h-[320px]">
        <ConnectomeCanvas phase={phase} />

        {/* Scanline sweep while the fly computes. */}
        {thinking && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 overflow-hidden"
          >
            <div className="animate-thinking-sweep h-full w-1/3 bg-[linear-gradient(90deg,transparent,rgba(56,189,248,0.07),transparent)]" />
          </div>
        )}

        <div className="pointer-events-none absolute left-4 top-3 font-mono text-[10px] tracking-widest text-muted">
          {thinking ? "SIMULATING" : "RESTING STATE"}
        </div>
      </div>

      {/* Legend */}
      <div className="grid grid-cols-2 gap-x-3 gap-y-2 border-t border-edge/80 px-4 py-3">
        {LEGEND.map((item) => (
          <div key={item.label} className="flex items-center gap-2">
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{
                backgroundColor: item.color,
                boxShadow: `0 0 8px 1px ${item.color}`,
              }}
            />
            <span className="truncate text-[11px] text-dim">{item.label}</span>
          </div>
        ))}
      </div>

      {/* Stats: one row, number above label, as on an instrument panel. */}
      <div className="grid grid-cols-2 divide-x divide-y divide-edge/70 border-t border-edge/80 sm:grid-cols-4 sm:divide-y-0">
        <Stat
          label="Neurons fired"
          value={activity?.neurons_fired ?? null}
          pending={thinking}
        />
        <Stat label="Spikes" value={activity?.spikes ?? null} pending={thinking} />
        <Stat
          label="Motor spikes"
          value={activity?.motor_spikes ?? null}
          pending={thinking}
        />
        <Stat
          label="Sim time"
          value={activity?.sim_time_ms ?? null}
          suffix=" ms"
          pending={thinking}
        />
      </div>

      {/* What the fly thought of each column. */}
      <div className="border-t border-edge/80">
        <ScoreList scores={scores} flyColumn={flyColumn} />
      </div>

      {/* Honest description of what is actually running. */}
      <div className="border-t border-edge/80 px-4 py-3">
        <h3 className="label-caps text-[10px] text-accent">How the fly plays</h3>
        <p className="mt-1.5 text-[12px] leading-relaxed text-dim">
          For now, each legal move is evaluated by a lightweight placeholder
          policy. The app is structured so this policy can later be replaced by
          a model whose computation is constrained by fruit-fly connectome
          topology.
        </p>
        <p className="mt-2 font-mono text-[10px] text-muted">
          policy: {model ?? "placeholder-heuristic"} · activity values are
          synthetic placeholders, not a connectome simulation
        </p>
      </div>
    </section>
  );
}
