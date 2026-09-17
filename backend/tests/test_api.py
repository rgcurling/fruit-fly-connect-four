"""Tests for the FastAPI surface."""

from __future__ import annotations

from fastapi.testclient import TestClient

from game.logic import COLS, FLY, HUMAN, ROWS, create_board, drop_piece
from main import app

from tests.helpers import board_from_rows

client = TestClient(app)


def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["rows"] == ROWS and body["cols"] == COLS
    assert body["model"]


def test_new_game_returns_an_empty_board():
    response = client.post("/new-game")
    assert response.status_code == 200
    body = response.json()
    assert body["board"] == create_board()
    assert body["legal_moves"] == list(range(COLS))
    assert body["winner"] is None
    assert body["is_draw"] is False


def test_move_returns_the_documented_shape():
    board = drop_piece(create_board(), 3, HUMAN)
    response = client.post("/move", json={"board": board})
    assert response.status_code == 200

    body = response.json()
    assert 0 <= body["column"] < COLS
    assert len(body["scores"]) == COLS
    activity = body["activity"]
    for key in ("neurons_fired", "spikes", "motor_spikes", "sim_time_ms"):
        assert isinstance(activity[key], int) and activity[key] >= 0
    assert body["model"]
    assert body["notes"]


def test_move_blocks_a_human_win():
    board = board_from_rows(["HHH...."])
    response = client.post("/move", json={"board": board})
    assert response.status_code == 200
    assert response.json()["column"] == 3


def test_move_rejects_a_malformed_board():
    assert client.post("/move", json={"board": [[0] * COLS] * 3}).status_code == 422
    assert client.post("/move", json={"board": "nope"}).status_code == 422

    floating = create_board()
    floating[0][0] = HUMAN
    assert client.post("/move", json={"board": floating}).status_code == 422


def test_move_rejects_a_finished_game():
    won = board_from_rows(["HHHH..."])
    response = client.post("/move", json={"board": won})
    assert response.status_code == 409

    full = [[HUMAN if (r + c) % 2 == 0 else FLY for c in range(COLS)] for r in range(ROWS)]
    assert client.post("/move", json={"board": full}).status_code == 409
