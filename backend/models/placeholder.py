"""Placeholder fly policy and the interface a real model must satisfy.

The whole point of this module is the seam. Everything upstream (the API, and
therefore the frontend) talks to :class:`FlyModel`, so replacing the heuristic
with a PyTorch connectome network means writing one new class that implements
``predict`` and returning it from :func:`get_fly_model`. No route handler and
no frontend code has to change.

Honesty note: the activity numbers below are *synthetic*. They are derived
deterministically from the board so the UI has something stable and plausible
to render, and they are labelled as placeholder wherever they surface.
"""

from __future__ import annotations

import random
from dataclasses import asdict, dataclass, field
from typing import Dict, List, Optional, Protocol, Sequence, runtime_checkable

from game.bot import HeuristicFlyBot
from game.logic import COLS, FLY, count_pieces, get_legal_moves


@dataclass(frozen=True)
class ActivityTrace:
    """Summary telemetry for one "simulation" of the fly brain.

    A real connectome run will populate exactly these fields from the spiking
    simulation, which is why the schema is fixed now.
    """

    neurons_fired: int
    spikes: int
    motor_spikes: int
    sim_time_ms: int

    def to_dict(self) -> Dict[str, int]:
        return asdict(self)


@dataclass(frozen=True)
class PolicyOutput:
    """What any fly model returns for a board position."""

    column: int
    scores: List[float]
    activity: ActivityTrace
    model: str = "placeholder-heuristic"
    notes: str = field(
        default=(
            "Placeholder heuristic policy. Activity telemetry is synthetic and "
            "does not come from a connectome simulation."
        )
    )


@runtime_checkable
class FlyModel(Protocol):
    """The contract the API depends on.

    A future ``ConnectomeFlyModel`` only has to implement this one method::

        def predict(self, board, player=FLY) -> PolicyOutput: ...
    """

    def predict(
        self, board: Sequence[Sequence[int]], player: int = FLY
    ) -> PolicyOutput: ...


# --- Synthetic telemetry -----------------------------------------------------
# Ranges are loosely inspired by the scale of a Drosophila central-brain
# simulation (~1.4e5 neurons, a few thousand of which are active in any short
# window). They exist to make the UI feel alive, not to model anything.
_BASE_NEURONS = 1_650
_NEURONS_PER_PIECE = 46
_SPIKES_PER_NEURON = 4.1
_BASE_MOTOR = 180
_MOTOR_PER_OPTION = 38


def _board_seed(board: Sequence[Sequence[int]]) -> int:
    """Stable seed derived from the exact position.

    The same board always produces the same telemetry, so the panel does not
    flicker between identical states, while different boards look different.
    """
    flat = "".join(str(cell + 1) for row in board for cell in row)
    return int(flat, 3) % (2**31)


def synthesize_activity(
    board: Sequence[Sequence[int]], chosen_column: int
) -> ActivityTrace:
    """Build a plausible, deterministic activity trace for ``board``."""
    rng = random.Random(_board_seed(board) + chosen_column)
    pieces = count_pieces(board)
    options = max(len(get_legal_moves(board)), 1)

    neurons = int(
        _BASE_NEURONS + pieces * _NEURONS_PER_PIECE + rng.uniform(-120, 260)
    )
    spikes = int(neurons * _SPIKES_PER_NEURON + rng.uniform(-400, 900))
    motor = int(_BASE_MOTOR + options * _MOTOR_PER_OPTION + rng.uniform(-30, 70))
    sim_time = int(120 + pieces * 2.4 + rng.uniform(0, 70))

    return ActivityTrace(
        neurons_fired=max(neurons, 0),
        spikes=max(spikes, 0),
        motor_spikes=max(motor, 0),
        sim_time_ms=max(sim_time, 1),
    )


class PlaceholderFlyModel:
    """Heuristic policy dressed in the :class:`FlyModel` interface."""

    name = "placeholder-heuristic"

    def __init__(self, seed: Optional[int] = None) -> None:
        self._bot = HeuristicFlyBot(seed=seed)

    def predict(
        self, board: Sequence[Sequence[int]], player: int = FLY
    ) -> PolicyOutput:
        legal = get_legal_moves(board)
        if not legal:
            raise ValueError("board is full; no move to make")

        column = self._bot.choose_move(board, player)
        scores = self._bot.normalized_scores(board, player)
        if len(scores) != COLS:  # defensive: the contract is a fixed-width vector
            scores = (scores + [0.0] * COLS)[:COLS]

        return PolicyOutput(
            column=column,
            scores=scores,
            activity=synthesize_activity(board, column),
            model=self.name,
        )


_MODEL: Optional[FlyModel] = None


def get_fly_model() -> FlyModel:
    """Return the process-wide fly model.

    Swap the constructor here (or wire an env var) to promote a trained
    connectome model into the app.
    """
    global _MODEL
    if _MODEL is None:
        _MODEL = PlaceholderFlyModel()
    return _MODEL
