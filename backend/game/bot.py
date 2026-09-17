"""The placeholder fly opponent: a small, deterministic-ish heuristic.

This is **not** a connectome model. It is a hand-written policy that plays a
competent game of Connect Four so the rest of the product can be built and
judged. Everything here is pure Python over :mod:`game.logic` boards, and the
only entry point the rest of the app needs is :func:`choose_move` /
:func:`score_moves`.
"""

from __future__ import annotations

import random
from typing import Dict, List, Optional, Sequence

from .logic import (
    COLS,
    CONNECT,
    EMPTY,
    FLY,
    HUMAN,
    ROWS,
    Board,
    check_winner,
    drop_piece,
    find_drop_row,
    get_legal_moves,
)

# --- Heuristic weights -------------------------------------------------------
# Tuned by hand to produce a bot that punishes obvious mistakes without being
# unbeatable. Magnitudes matter only relative to each other.
WIN_SCORE = 100_000.0
BLOCK_SCORE = 50_000.0
GIFT_PENALTY = -40_000.0  # move that hands the opponent a win directly above it

THREE_IN_WINDOW = 120.0  # own three + one empty
TWO_IN_WINDOW = 12.0  # own two + two empties
OPPONENT_THREE_IN_WINDOW = -140.0  # let an opponent three stand: slightly worse
CENTER_WEIGHT = 8.0  # per own piece in the centre column
CENTER_BIAS = 22.0  # tie-break pull toward the middle of the board


def _opponent(player: int) -> int:
    return HUMAN if player == FLY else FLY


def _windows(board: Sequence[Sequence[int]]) -> List[List[int]]:
    """Every length-4 line on the board, as lists of cell values."""
    windows: List[List[int]] = []
    for r in range(ROWS):
        for c in range(COLS):
            if c + CONNECT <= COLS:
                windows.append([board[r][c + i] for i in range(CONNECT)])
            if r + CONNECT <= ROWS:
                windows.append([board[r + i][c] for i in range(CONNECT)])
            if r + CONNECT <= ROWS and c + CONNECT <= COLS:
                windows.append([board[r + i][c + i] for i in range(CONNECT)])
            if r + CONNECT <= ROWS and c - CONNECT + 1 >= 0:
                windows.append([board[r + i][c - i] for i in range(CONNECT)])
    return windows


def evaluate_board(board: Sequence[Sequence[int]], player: int) -> float:
    """Static evaluation of ``board`` from ``player``'s point of view."""
    opponent = _opponent(player)
    score = 0.0

    center = COLS // 2
    center_column = [board[r][center] for r in range(ROWS)]
    score += center_column.count(player) * CENTER_WEIGHT
    score -= center_column.count(opponent) * CENTER_WEIGHT

    for window in _windows(board):
        own = window.count(player)
        theirs = window.count(opponent)
        empty = window.count(EMPTY)

        if own and theirs:
            continue  # contested window, nobody can complete it
        if own == 3 and empty == 1:
            score += THREE_IN_WINDOW
        elif own == 2 and empty == 2:
            score += TWO_IN_WINDOW
        elif theirs == 3 and empty == 1:
            score += OPPONENT_THREE_IN_WINDOW
        elif theirs == 2 and empty == 2:
            score -= TWO_IN_WINDOW

    return score


def _wins_immediately(board: Sequence[Sequence[int]], column: int, player: int) -> bool:
    """True if ``player`` dropping into ``column`` wins on the spot."""
    if find_drop_row(board, column) is None:
        return False
    return check_winner(drop_piece(board, column, player)) == player


def _gives_opponent_a_win(
    board: Sequence[Sequence[int]], column: int, player: int
) -> bool:
    """True if our move lets the opponent win by playing straight on top of it."""
    opponent = _opponent(player)
    after = drop_piece(board, column, player)
    if find_drop_row(after, column) is None:
        return False
    return _wins_immediately(after, column, opponent)


def score_moves(
    board: Sequence[Sequence[int]], player: int = FLY
) -> Dict[int, float]:
    """Score every legal column for ``player``. Higher is better.

    The ordering of the returned scores *is* the policy: :func:`choose_move`
    simply picks a maximum. Priorities fall out of the magnitudes:

    1. an immediate win outranks everything,
    2. blocking the opponent's immediate win comes next,
    3. moves that gift the opponent a win above them are heavily penalised,
    4. remaining moves are ranked by a windowed positional heuristic with a
       mild pull toward the centre.
    """
    opponent = _opponent(player)
    legal = get_legal_moves(board)
    scores: Dict[int, float] = {}

    center = (COLS - 1) / 2
    for column in legal:
        if _wins_immediately(board, column, player):
            scores[column] = WIN_SCORE
            continue
        if _wins_immediately(board, column, opponent):
            # Playing here occupies the square the opponent needs.
            scores[column] = BLOCK_SCORE
            continue

        score = evaluate_board(drop_piece(board, column, player), player)
        score += CENTER_BIAS * (1.0 - abs(column - center) / center)
        if _gives_opponent_a_win(board, column, player):
            score += GIFT_PENALTY
        scores[column] = score

    return scores


def choose_move(
    board: Sequence[Sequence[int]],
    player: int = FLY,
    rng: Optional[random.Random] = None,
) -> int:
    """Return the column the placeholder fly plays. Always legal.

    Ties are broken uniformly at random so repeated games differ.

    Raises:
        ValueError: if the board has no legal move at all.
    """
    scores = score_moves(board, player)
    if not scores:
        raise ValueError("no legal moves available")

    best = max(scores.values())
    # Small epsilon so float noise never collapses a genuine tie into one pick.
    contenders = [c for c, s in scores.items() if s >= best - 1e-9]
    chooser = rng or random
    return chooser.choice(contenders)


def normalized_scores(
    board: Sequence[Sequence[int]], player: int = FLY
) -> List[float]:
    """Per-column confidences in ``[0, 1]``, one entry per column.

    Illegal (full) columns are reported as ``0.0``. This is the shape the API
    exposes to the UI, and it is deliberately independent of the raw heuristic
    magnitudes so a future model can produce the same contract.
    """
    scores = score_moves(board, player)
    out = [0.0] * COLS
    if not scores:
        return out

    values = list(scores.values())
    lo, hi = min(values), max(values)
    span = hi - lo

    for column, value in scores.items():
        if span <= 1e-9:
            out[column] = 0.5
        else:
            # Map into 0.08..0.98 so even the worst legal move reads as "live".
            out[column] = round(0.08 + 0.90 * (value - lo) / span, 4)

    return out


class HeuristicFlyBot:
    """Object wrapper around the module-level functions.

    Useful for injecting a seeded RNG in tests, and it mirrors the shape a
    learned policy will have.
    """

    def __init__(self, seed: Optional[int] = None) -> None:
        self._rng = random.Random(seed)

    def choose_move(self, board: Sequence[Sequence[int]], player: int = FLY) -> int:
        return choose_move(board, player, rng=self._rng)

    def score_moves(
        self, board: Sequence[Sequence[int]], player: int = FLY
    ) -> Dict[int, float]:
        return score_moves(board, player)

    def normalized_scores(
        self, board: Sequence[Sequence[int]], player: int = FLY
    ) -> List[float]:
        return normalized_scores(board, player)
