/**
 * WebGL availability, probed once.
 *
 * Lives outside the scene because two things need the answer: the renderer
 * chooses between the 3D scene and the flat board, and the game loop chooses
 * whether the fly's move waits for an animation or commits immediately.
 */

import { useSyncExternalStore } from "react";

let probed: boolean | null = null;

function probe(): boolean {
  if (probed !== null) return probed;
  try {
    const canvas = document.createElement("canvas");
    probed = Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  } catch {
    probed = false;
  }
  return probed;
}

/** Nothing ever changes, so the subscription is a no-op. */
const subscribe = () => () => {};

/** On the server we know nothing yet. */
const serverSnapshot = (): boolean | null => null;

/** `null` until the browser has been asked. */
export function useWebglSupport(): boolean | null {
  return useSyncExternalStore<boolean | null>(subscribe, probe, serverSnapshot);
}
