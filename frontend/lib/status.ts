import { GameStatus } from "./types";

export interface StatusPresentation {
  /** Short all-caps label shown in the panel header and status bar. */
  label: string;
  /** One line of guidance for the player. */
  hint: string;
  /** Tailwind classes for the status dot. */
  dot: string;
  /** Tailwind text colour for the label. */
  text: string;
}

const DEFAULT_HINT = "Click a column (1-7) to drop your piece.";

export const STATUS: Record<GameStatus, StatusPresentation> = {
  "your-move": {
    label: "Your move",
    hint: DEFAULT_HINT,
    dot: "bg-chip-human",
    text: "text-chip-human",
  },
  "fly-thinking": {
    label: "Fly is thinking",
    hint: "The connectome panel is running its activation sequence.",
    dot: "bg-motor animate-live-blink",
    text: "text-motor",
  },
  "fly-moving": {
    label: "Fly is moving",
    hint: "The fly is carrying its piece to the column it chose.",
    dot: "bg-chip-fly animate-live-blink",
    text: "text-chip-fly",
  },
  "human-win": {
    label: "You win",
    hint: "You outplayed the fly. Start a new game to go again.",
    dot: "bg-emerald-400",
    text: "text-emerald-400",
  },
  "fly-win": {
    label: "The fly wins",
    hint: "The fly found four in a row. Start a new game for a rematch.",
    dot: "bg-chip-fly",
    text: "text-chip-fly",
  },
  draw: {
    label: "Draw",
    hint: "The board is full with no winner. Start a new game.",
    dot: "bg-dim",
    text: "text-dim",
  },
  error: {
    label: "Fly unreachable",
    hint: "The backend did not answer. Check that it is running, then retry.",
    dot: "bg-orange-400",
    text: "text-orange-400",
  },
};

/** Text announced to screen readers when the status changes. */
export function announcement(status: GameStatus): string {
  switch (status) {
    case "your-move":
      return "Your move. Choose a column from 1 to 7.";
    case "fly-thinking":
      return "The fly is thinking.";
    case "fly-moving":
      return "The fly is carrying its piece to the column it chose.";
    case "human-win":
      return "You win the game.";
    case "fly-win":
      return "The fly wins the game.";
    case "draw":
      return "The game is a draw.";
    case "error":
      return "The fly backend could not be reached.";
  }
}
