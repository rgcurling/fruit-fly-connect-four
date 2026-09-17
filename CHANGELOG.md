# Changelog

All notable changes to this project will be documented here.

## [0.2.0] - 2026-09-16

The board became a real-time 3D scene.

### Added
- Three.js scene rendered with React Three Fiber: an extruded board with all
  forty-two holes punched through it, chips that fall and settle, a low-poly
  fly hovering overhead, and an instanced grass field drawn in one call.
- Orbit controls, with a pointer-travel threshold so an orbit drag is never
  mistaken for a column click.
- A camera rig that reframes the board for the current canvas aspect, so the
  board is never cropped on a phone.
- WebGL fallback: without a context the game renders the flat CSS board and
  stays fully playable.
- Per-column score bars in the activity panel, fed by the score vector the API
  already returned but the UI never showed.

### Changed
- Connectome visualisation rewritten: about nine thousand points, rim-weighted
  optic lobe shells, batched by region and brightness so a frame costs a couple
  of dozen draw-state changes.
- Telemetry moved into a single instrument-style row.
- Header compacted to one line.
- Status bar moved inside the game panel.

### Notes
- Still no connectome data. The header names the male *Drosophila* CNS
  connectome as the next target, not as something that is running.

## [0.1.0] - 2026-09-16

First playable milestone.

### Added
- Connect Four rules in `backend/game/logic.py`, with 45 tests covering wins in
  all four directions, draws, full columns and board validation.
- Placeholder heuristic fly opponent (`backend/game/bot.py`): takes wins, blocks
  losses, avoids gifting a win, then scores positions with a windowed heuristic.
- `FlyModel` protocol and `PlaceholderFlyModel` (`backend/models/placeholder.py`)
  as the seam for a future connectome-derived model.
- FastAPI service exposing `/health`, `/new-game` and `/move`.
- Next.js frontend: playable board with chip-drop animation, hover previews,
  winner banner, session counters, accessible column buttons and status bar.
- Animated connectome-style activity panel with staged sensory to motor
  activation, legend and telemetry sourced from the backend response.

### Notes
- No connectome data is used yet. Activity telemetry is synthetic and labelled
  as such in the UI.
