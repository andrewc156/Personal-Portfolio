/**
 * Entry point for the extra hero modes, loaded with a dynamic import() only when one is chosen,
 * so the home page's initial JavaScript stays the Rising water hero alone (spec §7 budget).
 */
import { CollatzSim } from './collatz.ts';
import { DyeSim } from './dye.ts';
import type { HeroModeId } from './meta.ts';
import { PondSim } from './pond.ts';
import { RiversSim } from './rivers.ts';
import { ModeController, type ModeElements, type ModeSettings } from './shell.ts';
import type { ModeSim } from './types.ts';

export { ModeController };
export type { ModeElements, ModeSettings };

export type ExtraModeId = Exclude<HeroModeId, 'rising'>;

export function createSim(id: ExtraModeId): ModeSim {
  switch (id) {
    case 'dye':
      return new DyeSim();
    case 'pond':
      return new PondSim();
    case 'rivers':
      return new RiversSim();
    case 'collatz':
      return new CollatzSim();
  }
}

export function createMode(
  id: ExtraModeId,
  els: ModeElements,
  settings: ModeSettings,
  opts: { reducedMotion: boolean; autoplay?: boolean },
): ModeController {
  return new ModeController(els, createSim(id), settings, opts);
}
