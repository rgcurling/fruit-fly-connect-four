"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

import { Board, Cell, COLS, EMPTY, HUMAN, ROWS } from "@/lib/types";
import {
  CHIP_RADIUS,
  CHIP_THICKNESS,
  COLORS,
  DROP_START_Y,
  cellWorldPosition,
} from "./constants";

interface ChipsProps {
  board: Board;
  /** The chip that was just played, which is the one that animates. */
  lastMove: { row: number; column: number } | null;
  /** Cells in the winning line, lifted and lit. */
  winningCells: [number, number][] | null;
}

const DROP_MS = 520;

/** Gravity-ish fall with a small settle bounce at the end. */
function dropEase(t: number): number {
  if (t >= 1) return 1;
  if (t < 0.78) {
    const p = t / 0.78;
    return p * p; // accelerating fall
  }
  const p = (t - 0.78) / 0.22;
  return 1 - Math.sin(p * Math.PI) * 0.055; // bounce back up and settle
}

function Chip({
  row,
  column,
  player,
  animate,
  winning,
}: {
  row: number;
  column: number;
  player: Cell;
  animate: boolean;
  winning: boolean;
}) {
  const ref = useRef<THREE.Group>(null);
  const start = useRef<number | null>(null);
  const [x, y] = useMemo(() => cellWorldPosition(row, column), [row, column]);

  useFrame((state) => {
    const group = ref.current;
    if (!group) return;

    if (!animate) {
      group.position.y = y;
      return;
    }

    const now = state.clock.getElapsedTime() * 1000;
    if (start.current === null) start.current = now;

    const t = Math.min(1, (now - start.current) / DROP_MS);
    group.position.y = DROP_START_Y + (y - DROP_START_Y) * dropEase(t);
  });

  const color = player === HUMAN ? COLORS.human : COLORS.fly;

  return (
    <group ref={ref} position={[x, animate ? DROP_START_Y : y, 0]}>
      <mesh rotation={[Math.PI / 2, 0, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[CHIP_RADIUS, CHIP_RADIUS, CHIP_THICKNESS, 30]} />
        <meshStandardMaterial
          color={color}
          roughness={0.3}
          metalness={0.08}
          emissive={winning ? color : "#000000"}
          emissiveIntensity={winning ? 0.5 : 0}
        />
      </mesh>
    </group>
  );
}

export default function Chips({ board, lastMove, winningCells }: ChipsProps) {
  const isWinning = (row: number, column: number) =>
    winningCells?.some(([r, c]) => r === row && c === column) ?? false;

  const chips = [];
  for (let row = 0; row < ROWS; row += 1) {
    for (let column = 0; column < COLS; column += 1) {
      const cell = board[row][column];
      if (cell === EMPTY) continue;

      const animate = lastMove?.row === row && lastMove?.column === column;
      chips.push(
        <Chip
          // Keying on the move makes a newly played chip a fresh component, so
          // its drop animation starts from the top every time.
          key={`${row}-${column}-${cell}${animate ? "-drop" : ""}`}
          row={row}
          column={column}
          player={cell}
          animate={animate}
          winning={isWinning(row, column)}
        />,
      );
    }
  }

  return <group>{chips}</group>;
}
