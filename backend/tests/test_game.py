"""Tests for the Connect Four rules."""

from __future__ import annotations

import pytest

from game.logic import (
    COLS,
    EMPTY,
    FLY,
    HUMAN,
    ROWS,
    board_is_full,
    check_winner,
    count_pieces,
    create_board,
    drop_piece,
    find_drop_row,
    get_legal_moves,
    is_draw,
    is_legal_move,
    is_terminal,
    validate_board,
    winning_line,
)
from tests.helpers import board_from_rows


# --- Board basics ------------------------------------------------------------


def test_create_board_is_empty_and_right_shape():
    board = create_board()
    assert len(board) == ROWS
    assert all(len(row) == COLS for row in board)
    assert count_pieces(board) == 0
    assert check_winner(board) is None
    assert not is_draw(board)


def test_reset_game_returns_a_fresh_board():
    played = drop_piece(create_board(), 3, HUMAN)
    assert count_pieces(played) == 1
    # "Reset" is simply a new board; it must not share state with the old one.
    fresh = create_board()
    assert count_pieces(fresh) == 0
    assert played[ROWS - 1][3] == HUMAN


def test_drop_piece_falls_to_the_bottom_and_stacks():
    board = drop_piece(create_board(), 2, HUMAN)
    assert board[ROWS - 1][2] == HUMAN

    board = drop_piece(board, 2, FLY)
    assert board[ROWS - 2][2] == FLY
    assert board[ROWS - 1][2] == HUMAN


def test_drop_piece_does_not_mutate_the_input_board():
    board = create_board()
    drop_piece(board, 0, HUMAN)
    assert count_pieces(board) == 0


def test_drop_piece_rejects_bad_player_and_column():
    board = create_board()
    with pytest.raises(ValueError):
        drop_piece(board, 0, 2)
    with pytest.raises(ValueError):
        drop_piece(board, -1, HUMAN)
    with pytest.raises(ValueError):
        drop_piece(board, COLS, HUMAN)


def test_find_drop_row_reports_none_for_full_column():
    board = create_board()
    for i in range(ROWS):
        assert find_drop_row(board, 4) == ROWS - 1 - i
        board = drop_piece(board, 4, HUMAN if i % 2 == 0 else FLY)
    assert find_drop_row(board, 4) is None


# --- Legal moves / full columns ---------------------------------------------


def test_get_legal_moves_on_empty_board():
    assert get_legal_moves(create_board()) == list(range(COLS))


def test_full_column_is_rejected():
    board = create_board()
    for i in range(ROWS):
        board = drop_piece(board, 0, HUMAN if i % 2 == 0 else FLY)

    assert is_legal_move(board, 0) is False
    assert 0 not in get_legal_moves(board)
    assert get_legal_moves(board) == list(range(1, COLS))
    with pytest.raises(ValueError, match="full"):
        drop_piece(board, 0, HUMAN)


def test_is_legal_move_bounds():
    board = create_board()
    assert is_legal_move(board, 0) is True
    assert is_legal_move(board, COLS - 1) is True
    assert is_legal_move(board, -1) is False
    assert is_legal_move(board, COLS) is False


# --- Wins --------------------------------------------------------------------


def test_horizontal_win():
    board = board_from_rows(["HHHH...", ])
    assert check_winner(board) == HUMAN
    assert winning_line(board) == [(ROWS - 1, 0), (ROWS - 1, 1), (ROWS - 1, 2), (ROWS - 1, 3)]
    assert is_terminal(board)


def test_vertical_win():
    board = board_from_rows(
        [
            "F......",
            "F......",
            "F......",
            "F......",
        ]
    )
    assert check_winner(board) == FLY


def test_diagonal_win_going_up_to_the_right():
    """Human line on (5,0) -> (4,1) -> (3,2) -> (2,3), fully supported."""
    board = board_from_rows(
        [
            "HFFF...",
            ".HFF...",
            "..HF...",
            "...H...",
        ]
    )
    assert check_winner(board) == HUMAN
    assert winning_line(board) == [(2, 3), (3, 2), (4, 1), (5, 0)] or set(
        winning_line(board)
    ) == {(2, 3), (3, 2), (4, 1), (5, 0)}


def test_diagonal_win_going_down_to_the_right():
    """Fly line on (2,3) -> (3,4) -> (4,5) -> (5,6), fully supported."""
    board = board_from_rows(
        [
            "...HHHF",
            "...HHF.",
            "...HF..",
            "...F...",
        ]
    )
    assert set(winning_line(board)) == {(2, 3), (3, 4), (4, 5), (5, 6)}
    assert check_winner(board) == FLY


def test_no_winner_on_three_in_a_row():
    board = board_from_rows(["HHH.FFF"])
    assert check_winner(board) is None
    assert not is_terminal(board)


def test_mixed_window_is_not_a_win():
    board = board_from_rows(["HHFH..."])
    assert check_winner(board) is None


# --- Draws -------------------------------------------------------------------


def _drawn_board() -> list[list[int]]:
    """A full board with 21 pieces each and no four in a row anywhere.

    Found by exhaustive search so the draw test rests on a real position
    rather than a hand-waved pattern.
    """
    return board_from_rows(
        [
            "HHHFHHH",
            "HHHFHHH",
            "HHFHFFF",
            "FFFHFHF",
            "HFFFHFF",
            "FFHFFFH",
        ]
    )


def test_draw_detection():
    board = _drawn_board()
    assert board_is_full(board)
    assert check_winner(board) is None
    assert is_draw(board) is True
    assert get_legal_moves(board) == []
    assert is_terminal(board)


def test_full_board_with_a_winner_is_not_a_draw():
    board = _drawn_board()
    board[ROWS - 1][0] = HUMAN
    board[ROWS - 1][1] = HUMAN
    board[ROWS - 1][2] = HUMAN
    board[ROWS - 1][3] = HUMAN
    assert check_winner(board) == HUMAN
    assert is_draw(board) is False


def test_partially_filled_board_is_not_a_draw():
    board = drop_piece(create_board(), 3, HUMAN)
    assert not board_is_full(board)
    assert is_draw(board) is False


# --- Validation --------------------------------------------------------------


def test_validate_board_accepts_a_legal_position():
    board = drop_piece(create_board(), 3, HUMAN)
    assert validate_board(board) == board


def test_validate_board_rejects_bad_shape_values_and_floating_pieces():
    with pytest.raises(ValueError):
        validate_board([[0] * COLS] * (ROWS - 1))
    with pytest.raises(ValueError):
        validate_board([[0] * (COLS + 1)] * ROWS)

    bad_value = create_board()
    bad_value[0][0] = 7
    with pytest.raises(ValueError):
        validate_board(bad_value)

    floating = create_board()
    floating[0][0] = HUMAN  # top cell filled with nothing beneath it
    with pytest.raises(ValueError, match="floating"):
        validate_board(floating)
