"""Pure Connect Four rules.

No framework imports live here on purpose: this module is the canonical
description of the game and is exercised directly by the test-suite.

Board representation
--------------------
A board is a list of ``ROWS`` rows, each a list of ``COLS`` ints.
Row 0 is the *top* of the board, row ``ROWS - 1`` is the floor, so a piece
dropped into an empty column lands at row ``ROWS - 1``.

Cell values:
    ``0``  empty
    ``1``  human
    ``-1`` fly
"""

from __future__ import annotations

from typing import List, Optional, Sequence, Tuple

ROWS = 6
COLS = 7
CONNECT = 4

EMPTY = 0
HUMAN = 1
FLY = -1

Board = List[List[int]]
Cell = Tuple[int, int]

#: Direction vectors for the four win orientations: horizontal, vertical and
#: both diagonals. Only one direction per axis is needed because every line is
#: scanned from each of its cells.
_DIRECTIONS: Tuple[Cell, ...] = ((0, 1), (1, 0), (1, 1), (1, -1))


def create_board() -> Board:
    """Return a fresh empty board."""
    return [[EMPTY for _ in range(COLS)] for _ in range(ROWS)]


def copy_board(board: Sequence[Sequence[int]]) -> Board:
    """Return a deep copy of ``board``."""
    return [list(row) for row in board]


def validate_board(board: Sequence[Sequence[int]]) -> Board:
    """Validate an untrusted board and return it as a normalised copy.

    Raises:
        ValueError: if the shape is wrong, a cell holds an unknown value, or a
            column contains a floating piece (a gap beneath an occupied cell).
    """
    if len(board) != ROWS:
        raise ValueError(f"board must have {ROWS} rows, got {len(board)}")

    normalised: Board = []
    for r, row in enumerate(board):
        if len(row) != COLS:
            raise ValueError(f"row {r} must have {COLS} columns, got {len(row)}")
        for value in row:
            if value not in (EMPTY, HUMAN, FLY):
                raise ValueError(f"illegal cell value {value!r}; expected 0, 1 or -1")
        normalised.append([int(value) for value in row])

    for c in range(COLS):
        seen_piece = False
        for r in range(ROWS):  # top to bottom
            if normalised[r][c] != EMPTY:
                seen_piece = True
            elif seen_piece:
                raise ValueError(f"column {c} has a floating piece above an empty cell")

    return normalised


def is_legal_move(board: Sequence[Sequence[int]], column: int) -> bool:
    """True when ``column`` is on the board and not yet full."""
    if not isinstance(column, int) or isinstance(column, bool):
        return False
    if not 0 <= column < COLS:
        return False
    return board[0][column] == EMPTY


def get_legal_moves(board: Sequence[Sequence[int]]) -> List[int]:
    """Return the columns that still have room, left to right."""
    return [c for c in range(COLS) if board[0][c] == EMPTY]


def find_drop_row(board: Sequence[Sequence[int]], column: int) -> Optional[int]:
    """Return the row a piece would land in, or ``None`` if the column is full."""
    if not 0 <= column < COLS:
        return None
    for r in range(ROWS - 1, -1, -1):  # bottom to top
        if board[r][column] == EMPTY:
            return r
    return None


def drop_piece(board: Sequence[Sequence[int]], column: int, player: int) -> Board:
    """Return a **new** board with ``player``'s piece dropped into ``column``.

    The input board is never mutated, which keeps search and scoring code free
    of undo bookkeeping.

    Raises:
        ValueError: if the player is unknown or the column is out of range/full.
    """
    if player not in (HUMAN, FLY):
        raise ValueError(f"player must be {HUMAN} or {FLY}, got {player!r}")
    if not 0 <= column < COLS:
        raise ValueError(f"column must be in 0..{COLS - 1}, got {column!r}")

    row = find_drop_row(board, column)
    if row is None:
        raise ValueError(f"column {column} is full")

    next_board = copy_board(board)
    next_board[row][column] = player
    return next_board


def winning_line(board: Sequence[Sequence[int]]) -> Optional[List[Cell]]:
    """Return the four cells of the first winning line found, else ``None``."""
    for r in range(ROWS):
        for c in range(COLS):
            player = board[r][c]
            if player == EMPTY:
                continue
            for dr, dc in _DIRECTIONS:
                end_r = r + dr * (CONNECT - 1)
                end_c = c + dc * (CONNECT - 1)
                if not (0 <= end_r < ROWS and 0 <= end_c < COLS):
                    continue
                cells = [(r + dr * i, c + dc * i) for i in range(CONNECT)]
                if all(board[cr][cc] == player for cr, cc in cells):
                    return cells
    return None


def check_winner(board: Sequence[Sequence[int]]) -> Optional[int]:
    """Return ``HUMAN``, ``FLY``, or ``None`` when nobody has four in a row."""
    cells = winning_line(board)
    if cells is None:
        return None
    r, c = cells[0]
    return board[r][c]


def board_is_full(board: Sequence[Sequence[int]]) -> bool:
    """True when no column has room left."""
    return all(board[0][c] != EMPTY for c in range(COLS))


def is_draw(board: Sequence[Sequence[int]]) -> bool:
    """True when the board is full and nobody has won."""
    return board_is_full(board) and check_winner(board) is None


def is_terminal(board: Sequence[Sequence[int]]) -> bool:
    """True when the game is over for any reason."""
    return check_winner(board) is not None or board_is_full(board)


def count_pieces(board: Sequence[Sequence[int]]) -> int:
    """Number of pieces currently on the board."""
    return sum(1 for row in board for cell in row if cell != EMPTY)
