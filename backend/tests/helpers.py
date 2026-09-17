"""Shared test helpers."""

from __future__ import annotations

from typing import List

from game.logic import COLS, EMPTY, FLY, HUMAN, ROWS, create_board

_SYMBOLS = {".": EMPTY, "H": HUMAN, "F": FLY}


def board_from_rows(rows: List[str]) -> List[List[int]]:
    """Build a board from bottom-up ASCII rows.

    ``.`` empty, ``H`` human, ``F`` fly. The first string is the *bottom* row,
    so the literal in the test reads the way the board looks on screen.
    """
    assert len(rows) <= ROWS, "too many rows"
    board = create_board()
    for offset, row in enumerate(rows):
        assert len(row) == COLS, f"row {row!r} must be {COLS} wide"
        r = ROWS - 1 - offset
        for c, ch in enumerate(row):
            board[r][c] = _SYMBOLS[ch]
    return board
