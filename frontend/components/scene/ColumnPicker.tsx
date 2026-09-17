"use client";

import { ThreeEvent } from "@react-three/fiber";
import { useRef, useState } from "react";

import { findDropRow } from "@/lib/game";
import { Board, COLS } from "@/lib/types";
import {
  BOARD_HEIGHT,
  BOARD_LIFT,
  CELL,
  CHIP_RADIUS,
  CHIP_THICKNESS,
  COLORS,
  cellWorldPosition,
} from "./constants";

interface ColumnPickerProps {
  board: Board;
  disabled: boolean;
  onDrop: (column: number) => void;
}

/** Pointer travel beyond this is an orbit drag, not a click on a column. */
const DRAG_SLOP_PX = 6;

/**
 * Invisible slabs in front of the board, one per column.
 *
 * They catch the pointer, show where the chip would land, and drop it. The
 * slop check keeps an orbit drag that happens to end over a column from being
 * read as a move.
 */
export default function ColumnPicker({
  board,
  disabled,
  onDrop,
}: ColumnPickerProps) {
  const [hovered, setHovered] = useState<number | null>(null);
  const pressOrigin = useRef<{ x: number; y: number } | null>(null);

  const handlePointerDown = (event: ThreeEvent<PointerEvent>) => {
    pressOrigin.current = { x: event.clientX, y: event.clientY };
  };

  const handlePointerUp = (column: number) => (event: ThreeEvent<PointerEvent>) => {
    const origin = pressOrigin.current;
    pressOrigin.current = null;
    if (!origin || disabled) return;

    const travelled = Math.hypot(event.clientX - origin.x, event.clientY - origin.y);
    if (travelled > DRAG_SLOP_PX) return;

    if (findDropRow(board, column) !== null) onDrop(column);
  };

  const landingRow = hovered === null ? null : findDropRow(board, hovered);
  const ghost =
    hovered !== null && landingRow !== null && !disabled
      ? cellWorldPosition(landingRow, hovered)
      : null;

  return (
    <group>
      {Array.from({ length: COLS }, (_, column) => {
        const [x] = cellWorldPosition(0, column);
        const full = findDropRow(board, column) === null;
        const active = hovered === column && !disabled && !full;

        return (
          <group key={column}>
            <mesh
              position={[x, BOARD_LIFT + BOARD_HEIGHT / 2, 0.55]}
              visible={false}
              onPointerOver={() => !disabled && setHovered(column)}
              onPointerOut={() =>
                setHovered((prev) => (prev === column ? null : prev))
              }
              onPointerDown={handlePointerDown}
              onPointerUp={handlePointerUp(column)}
            >
              <boxGeometry args={[CELL, BOARD_HEIGHT, 1.1]} />
            </mesh>

            {/* Column wash while hovering. */}
            {active && (
              <mesh position={[x, BOARD_LIFT + BOARD_HEIGHT / 2, 0.29]}>
                <planeGeometry args={[CELL * 0.94, BOARD_HEIGHT - 0.2]} />
                <meshBasicMaterial
                  color={COLORS.human}
                  transparent
                  opacity={0.12}
                  depthWrite={false}
                />
              </mesh>
            )}

            {/* Marker floating above the column being aimed at. */}
            {active && (
              <mesh
                position={[x, BOARD_LIFT + BOARD_HEIGHT + 0.55, 0]}
                rotation={[Math.PI / 2, 0, 0]}
              >
                <cylinderGeometry args={[0.16, 0.16, 0.06, 18]} />
                <meshStandardMaterial
                  color={COLORS.human}
                  emissive={COLORS.human}
                  emissiveIntensity={1.2}
                />
              </mesh>
            )}
          </group>
        );
      })}

      {/* Ghost chip in the cell the piece would fall into. */}
      {ghost && (
        <mesh position={[ghost[0], ghost[1], 0]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry
            args={[CHIP_RADIUS * 0.92, CHIP_RADIUS * 0.92, CHIP_THICKNESS * 0.6, 26]}
          />
          <meshStandardMaterial
            color={COLORS.human}
            transparent
            opacity={0.26}
            emissive={COLORS.human}
            emissiveIntensity={0.35}
            depthWrite={false}
          />
        </mesh>
      )}
    </group>
  );
}
