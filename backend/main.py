"""FastAPI surface for the fly opponent.

Deliberately thin: the routes validate input, delegate to the game rules and
the current fly model, and shape the response. All game intelligence lives in
``game/`` and ``models/``.
"""

from __future__ import annotations

import os
from typing import Dict, List

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from game.logic import (
    COLS,
    ROWS,
    check_winner,
    create_board,
    get_legal_moves,
    is_draw,
    validate_board,
)
from models.placeholder import get_fly_model

API_VERSION = "0.1.0"

app = FastAPI(
    title="Connect Four vs. a Fruit Fly",
    version=API_VERSION,
    description=(
        "Move selection for the fruit-fly opponent. The current policy is a "
        "placeholder heuristic; the response schema is fixed so a "
        "connectome-derived model can replace it without a client change."
    ),
)

# The frontend dev server runs on a different origin.
_default_origins = "http://localhost:3000,http://127.0.0.1:3000"
_origins = [
    o.strip() for o in os.getenv("CORS_ORIGINS", _default_origins).split(",") if o.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)


# --- Schemas -----------------------------------------------------------------


class Activity(BaseModel):
    """Telemetry for one fly "thought". Synthetic in this release."""

    neurons_fired: int = Field(..., ge=0, examples=[2418])
    spikes: int = Field(..., ge=0, examples=[9821])
    motor_spikes: int = Field(..., ge=0, examples=[412])
    sim_time_ms: int = Field(..., ge=0, examples=[184])


class MoveRequest(BaseModel):
    board: List[List[int]] = Field(
        ...,
        description=f"{ROWS}x{COLS} grid. 0 empty, 1 human, -1 fly. Row 0 is the top.",
    )


class MoveResponse(BaseModel):
    column: int = Field(..., ge=0, lt=COLS)
    scores: List[float] = Field(
        ..., description="Per-column confidence in [0,1]; full columns report 0."
    )
    activity: Activity
    model: str = Field(..., description="Identifier of the policy that moved.")
    notes: str = Field(..., description="Human-readable caveat about the policy.")


class BoardState(BaseModel):
    board: List[List[int]]
    legal_moves: List[int]
    winner: int | None = Field(None, description="1 human, -1 fly, null for none.")
    is_draw: bool


class Health(BaseModel):
    status: str
    version: str
    model: str
    rows: int
    cols: int


# --- Routes ------------------------------------------------------------------


@app.get("/", include_in_schema=False)
def root() -> Dict[str, str]:
    return {
        "name": "Connect Four vs. a Fruit Fly",
        "docs": "/docs",
        "health": "/health",
    }


@app.get("/health", response_model=Health)
def health() -> Health:
    """Liveness probe, also reports which policy is loaded."""
    model = get_fly_model()
    return Health(
        status="ok",
        version=API_VERSION,
        model=getattr(model, "name", type(model).__name__),
        rows=ROWS,
        cols=COLS,
    )


@app.post("/new-game", response_model=BoardState)
def new_game() -> BoardState:
    """Return a fresh empty board. The human moves first."""
    board = create_board()
    return BoardState(
        board=board, legal_moves=get_legal_moves(board), winner=None, is_draw=False
    )


@app.post("/move", response_model=MoveResponse)
def move(request: MoveRequest) -> MoveResponse:
    """Choose the fly's next move for the supplied position."""
    try:
        board = validate_board(request.board)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    if check_winner(board) is not None:
        raise HTTPException(status_code=409, detail="game is already won")
    if is_draw(board):
        raise HTTPException(status_code=409, detail="game is already drawn")
    if not get_legal_moves(board):
        raise HTTPException(status_code=409, detail="board is full")

    result = get_fly_model().predict(board)
    return MoveResponse(
        column=result.column,
        scores=result.scores,
        activity=Activity(**result.activity.to_dict()),
        model=result.model,
        notes=result.notes,
    )
