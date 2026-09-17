"""Tests for the placeholder fly policy and the model seam."""

from __future__ import annotations

import random

import pytest

from game.bot import HeuristicFlyBot, choose_move, normalized_scores, score_moves
from game.logic import (
    COLS,
    EMPTY,
    FLY,
    HUMAN,
    ROWS,
    check_winner,
    create_board,
    drop_piece,
    get_legal_moves,
    is_terminal,
)
from models.placeholder import PlaceholderFlyModel, PolicyOutput

from tests.helpers import board_from_rows


# --- Legality ----------------------------------------------------------------


def test_bot_returns_a_legal_move_on_an_empty_board():
    assert choose_move(create_board(), FLY) in get_legal_moves(create_board())


def test_bot_always_returns_a_legal_move_over_random_playouts():
    """Play many random games; every fly move must be legal."""
    rng = random.Random(1234)
    for _ in range(40):
        board = create_board()
        turn = HUMAN
        while not is_terminal(board):
            legal = get_legal_moves(board)
            if turn == FLY:
                column = choose_move(board, FLY, rng=rng)
                assert column in legal, f"illegal fly move {column}, legal={legal}"
            else:
                column = rng.choice(legal)
            board = drop_piece(board, column, turn)
            turn = HUMAN if turn == FLY else FLY


def test_bot_plays_the_only_legal_move_when_one_column_remains():
    board = create_board()
    for c in range(COLS):
        if c == 5:
            continue
        for r in range(ROWS):
            board[r][c] = HUMAN if (r + c) % 2 == 0 else FLY
    assert get_legal_moves(board) == [5]
    assert choose_move(board, FLY) == 5


def test_bot_raises_on_a_full_board():
    board = [[HUMAN if (r + c) % 2 == 0 else FLY for c in range(COLS)] for r in range(ROWS)]
    with pytest.raises(ValueError):
        choose_move(board, FLY)


# --- Tactics -----------------------------------------------------------------


def test_bot_takes_an_immediate_horizontal_win():
    # Fly has three on the bottom left; column 3 completes the line.
    board = board_from_rows(["FFF..HH"])
    assert choose_move(board, FLY) == 3


def test_bot_takes_an_immediate_vertical_win():
    board = board_from_rows(
        [
            "F.HH...",
            "F..H...",
            "F......",
        ]
    )
    assert choose_move(board, FLY) == 0


def test_bot_takes_a_win_even_when_the_human_also_threatens():
    """Winning now beats blocking."""
    board = board_from_rows(["FFF.HHH"])
    # Column 3 both wins for the fly and blocks the human; it must pick it.
    assert choose_move(board, FLY) == 3


def test_bot_prefers_its_own_win_over_a_block_elsewhere():
    board = board_from_rows(
        [
            "FFF.HHH",
            "HHH....",
        ]
    )
    # Bottom row col 3 is the fly's win (and a block). Row above is noise.
    move = choose_move(board, FLY)
    assert check_winner(drop_piece(board, move, FLY)) == FLY


def test_bot_blocks_an_immediate_human_horizontal_win():
    board = board_from_rows(["HHH.F.."])
    assert choose_move(board, FLY) == 3


def test_bot_blocks_an_immediate_human_vertical_win():
    board = board_from_rows(
        [
            "H.F....",
            "H.F....",
            "H......",
        ]
    )
    assert choose_move(board, FLY) == 0


def test_bot_blocks_one_end_of_an_open_three():
    """An open three cannot be fully stopped, but the fly must still block an end."""
    board = board_from_rows([".HHH..."])
    assert choose_move(board, FLY) in (0, 4)


def test_bot_prefers_the_center_on_an_empty_board():
    """With nothing else to separate columns, the middle should win out."""
    scores = score_moves(create_board(), FLY)
    assert max(scores, key=scores.get) == COLS // 2


def test_bot_does_not_hand_the_human_a_win_directly_above():
    """Playing col 2 would put the human's winning square in reach."""
    board = board_from_rows(
        [
            "..F....",
            "..H....",
            "..H....",
            "..H....",
        ]
    )
    # Column 2 holds F,H,H,H from the bottom. The human already has three
    # stacked, so the fly must block there rather than anywhere else.
    assert choose_move(board, FLY) == 2


# --- Score vector ------------------------------------------------------------


def test_normalized_scores_shape_and_range():
    scores = normalized_scores(create_board(), FLY)
    assert len(scores) == COLS
    assert all(0.0 <= s <= 1.0 for s in scores)
    assert max(scores) > 0


def test_normalized_scores_report_zero_for_full_columns():
    board = create_board()
    for r in range(ROWS):
        board[r][0] = HUMAN if r % 2 else FLY
    scores = normalized_scores(board, FLY)
    assert scores[0] == 0.0
    assert any(s > 0 for s in scores[1:])


def test_seeded_bot_is_reproducible():
    board = create_board()
    a = HeuristicFlyBot(seed=7)
    b = HeuristicFlyBot(seed=7)
    assert [a.choose_move(board) for _ in range(10)] == [
        b.choose_move(board) for _ in range(10)
    ]


# --- Model seam --------------------------------------------------------------


def test_placeholder_model_returns_the_full_policy_output():
    model = PlaceholderFlyModel(seed=3)
    result = model.predict(create_board())

    assert isinstance(result, PolicyOutput)
    assert result.column in get_legal_moves(create_board())
    assert len(result.scores) == COLS
    assert result.activity.neurons_fired > 0
    assert result.activity.spikes > 0
    assert result.activity.motor_spikes > 0
    assert result.activity.sim_time_ms > 0
    assert "placeholder" in result.notes.lower()


def test_activity_is_deterministic_for_the_same_board():
    model = PlaceholderFlyModel(seed=11)
    board = board_from_rows(["..HF..."])
    first = model.predict(board)
    second = model.predict(board)
    assert first.activity == second.activity


def test_model_refuses_a_full_board():
    board = [[HUMAN if (r + c) % 2 == 0 else FLY for c in range(COLS)] for r in range(ROWS)]
    with pytest.raises(ValueError):
        PlaceholderFlyModel().predict(board)
