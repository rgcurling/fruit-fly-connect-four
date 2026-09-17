"""Fly "models": whatever currently decides the fly's move.

Today this is a heuristic. The :class:`FlyModel` protocol is the seam where a
connectome-derived network will be dropped in later.
"""

from .placeholder import (
    ActivityTrace,
    FlyModel,
    PlaceholderFlyModel,
    PolicyOutput,
    get_fly_model,
)

__all__ = [
    "ActivityTrace",
    "FlyModel",
    "PlaceholderFlyModel",
    "PolicyOutput",
    "get_fly_model",
]
