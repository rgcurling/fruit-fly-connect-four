"use client";

import { useState } from "react";

type SectionKey = "about" | "method" | "data";

interface Section {
  key: SectionKey;
  label: string;
  body: string;
}

/**
 * The three nav items open a short, honest note rather than a dead link.
 * Keep this copy accurate: it is the first place a visitor checks whether the
 * "connectome" claim is real.
 */
const SECTIONS: Section[] = [
  {
    key: "about",
    label: "About",
    body: "A Connect Four board, a fly-shaped opponent, and a live activity panel. This is the first milestone of a longer project: build the whole playable experience first, then replace the opponent's brain with something derived from a real fruit-fly connectome.",
  },
  {
    key: "method",
    label: "Method",
    body: "Right now the fly plays a hand-written heuristic: take a win, block a loss, avoid handing over a win, then score the remaining columns on a windowed positional evaluation with a pull toward the centre. The move is chosen by the Python backend and returned with a per-column score vector, so a learned policy can take its place behind the same API.",
  },
  {
    key: "data",
    label: "Data",
    body: "No connectome data is loaded in this version. The neuron counts, spike counts and simulation time in the right-hand panel are synthetic values generated from the board position to drive the visualisation. The next milestone swaps them for measurements from an actual sparse network run.",
  },
];

interface TopNavProps {
  onNewGame: () => void;
  /** Label flips to NEW GAME once a game is under way. */
  hasStarted: boolean;
}

export default function TopNav({ onNewGame, hasStarted }: TopNavProps) {
  const [open, setOpen] = useState<SectionKey | null>(null);
  const active = SECTIONS.find((section) => section.key === open) ?? null;

  return (
    <header className="border-b border-edge/70 bg-void/70 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1500px] flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3 sm:px-6">
        {/* Full width on phones so the title never squeezes beside the nav. */}
        <div className="flex w-full min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1 sm:flex-1">
          <h1 className="text-balance text-lg font-semibold tracking-tight text-slate-100 sm:text-xl">
            Connect Four vs. a{" "}
            <span className="text-accent">Fruit Fly</span>
          </h1>
          {/* The dataset named here is the target, not what is running. */}
          <p className="text-[11px] text-muted">
            placeholder policy{" "}
            <span className="text-edge-bright">&middot;</span> male{" "}
            <em className="not-italic text-dim">Drosophila</em> CNS connectome
            next
          </p>
        </div>

        <nav
          aria-label="Project information"
          className="flex w-full flex-wrap items-center gap-1 sm:w-auto"
        >
          {SECTIONS.map((section) => (
            <button
              key={section.key}
              type="button"
              aria-expanded={open === section.key}
              aria-controls="topnav-detail"
              onClick={() =>
                setOpen((prev) => (prev === section.key ? null : section.key))
              }
              className={`
                label-caps rounded-md px-2.5 py-1.5 text-[10px] transition-colors
                ${
                  open === section.key
                    ? "bg-panel-soft text-accent"
                    : "text-muted hover:text-dim"
                }
              `}
            >
              {section.label}
            </button>
          ))}

          <button
            type="button"
            onClick={onNewGame}
            className="
              label-caps ml-auto rounded-md border border-accent/40 bg-accent/10 sm:ml-2
              px-3.5 py-1.5 text-[10px] text-accent transition-colors
              hover:border-accent/70 hover:bg-accent/20
            "
          >
            {hasStarted ? "New game" : "Play"}
          </button>
        </nav>
      </div>

      {active && (
        <div
          id="topnav-detail"
          className="animate-rise-in border-t border-edge/60 bg-panel/80"
        >
          <div className="mx-auto flex max-w-[1500px] items-start gap-4 px-4 py-3 sm:px-6">
            <p className="max-w-3xl text-[12px] leading-relaxed text-dim">
              <span className="label-caps mr-2 text-accent">{active.label}</span>
              {active.body}
            </p>
            <button
              type="button"
              onClick={() => setOpen(null)}
              aria-label="Close panel"
              className="ml-auto shrink-0 rounded-md px-2 py-1 text-muted transition-colors hover:text-dim"
            >
              &times;
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
