import { describe, expect, it } from 'vitest';
import { PlaybackIntent, progressMilestone } from '../../../src/lib/viz/hero/playback.ts';

/** F26 QA-04/QA-05: the manual-pause state machine shared across hero modes. */
describe('PlaybackIntent', () => {
  it('autoplays by default, never under reduced motion', () => {
    const p = new PlaybackIntent();
    expect(p.userPaused).toBe(false);
    expect(p.shouldAutoplay(false)).toBe(true);
    expect(p.shouldAutoplay(true)).toBe(false);
  });

  it('a manual pause persists until the user plays again', () => {
    const p = new PlaybackIntent();
    p.on('user-pause');
    expect(p.shouldAutoplay(false)).toBe(false);
    // Mode switches don't touch the flag; several in a row stay paused.
    expect(p.shouldAutoplay(false)).toBe(false);
    p.on('user-play');
    expect(p.userPaused).toBe(false);
    expect(p.shouldAutoplay(false)).toBe(true);
  });

  it('reaching the end is not a manual pause', () => {
    const p = new PlaybackIntent();
    p.on('ended');
    expect(p.userPaused).toBe(false);
    expect(p.shouldAutoplay(false)).toBe(true);
    // …and doesn't clear one either.
    p.on('user-pause');
    p.on('ended');
    expect(p.userPaused).toBe(true);
  });

  it('a system reduced-motion pause is not a manual pause', () => {
    const p = new PlaybackIntent();
    p.on('system-pause');
    expect(p.userPaused).toBe(false);
    expect(p.shouldAutoplay(true)).toBe(false);
    expect(p.shouldAutoplay(false)).toBe(true);
  });

  it('replay (user-play after the end) clears an earlier pause', () => {
    const p = new PlaybackIntent();
    p.on('user-pause');
    p.on('ended');
    p.on('user-play');
    expect(p.shouldAutoplay(false)).toBe(true);
  });
});

describe('progressMilestone', () => {
  it('returns quarters 0…4 and clamps', () => {
    expect(progressMilestone(-1)).toBe(0);
    expect(progressMilestone(Number.NaN)).toBe(0);
    expect(progressMilestone(0)).toBe(0);
    expect(progressMilestone(0.2499)).toBe(0);
    expect(progressMilestone(0.25)).toBe(1);
    expect(progressMilestone(0.5)).toBe(2);
    expect(progressMilestone(0.99)).toBe(3);
    expect(progressMilestone(1)).toBe(4);
    expect(progressMilestone(2)).toBe(4);
  });

  it('changes only a handful of times across a full rise (no per-frame announcements)', () => {
    let last = progressMilestone(0);
    let changes = 0;
    for (let f = 1; f <= 840; f++) {
      const m = progressMilestone(f / 840); // 14 s at 60 fps
      if (m !== last) changes++;
      last = m;
    }
    expect(changes).toBe(4);
  });

  it('supports other step counts', () => {
    expect(progressMilestone(0.55, 10)).toBe(5);
    expect(progressMilestone(1, 10)).toBe(10);
  });
});
