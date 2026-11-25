/**
 * Playback intent shared across hero modes (F26, QA-04/QA-05). Pure and DOM-free so it can be
 * unit-tested. hero-client.ts owns one instance for the page; each controller reports only the
 * user's own Play/Pause/scrub actions to it, never automatic stops.
 *
 * - A user-initiated pause (Pause button, Space, scrubbing the level) sets `userPaused`, so the
 *   next mode starts paused instead of autoplaying.
 * - Play or replay clears it.
 * - An animation reaching its end, a system reduced-motion pause, or the off-screen / hidden-tab
 *   pause are not user pauses and leave the flag alone.
 */
export type PlaybackEvent =
  | 'user-play'
  | 'user-pause'
  /** The animation reached its end and stopped on its own (Rising water with loop off). */
  | 'ended'
  /** System reduced motion switched on while something was playing. */
  | 'system-pause';

export class PlaybackIntent {
  userPaused = false;

  on(event: PlaybackEvent): void {
    if (event === 'user-play') this.userPaused = false;
    else if (event === 'user-pause') this.userPaused = true;
    // 'ended' and 'system-pause' are not manual pauses: the flag stays as it was.
  }

  /** Should a newly started mode play by itself? */
  shouldAutoplay(reducedMotion: boolean): boolean {
    return !reducedMotion && !this.userPaused;
  }
}

/**
 * Coarse progress milestone for the live summary during playback: 0 … steps for p ∈ [0, 1]
 * (quarters by default). The controller announces only when this number changes, never per
 * frame.
 */
export function progressMilestone(p: number, steps = 4): number {
  if (!(p > 0)) return 0;
  if (p >= 1) return steps;
  return Math.floor(p * steps);
}
