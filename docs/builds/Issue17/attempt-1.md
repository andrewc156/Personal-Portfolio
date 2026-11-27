# Build report — Issue #17 hero and explorer select controls — attempt 1

The hero Animation select and explorer Speed and Pacing selects use the shared `.select-field` class. The hero toolbar retains a 44 px minimum height for the Animation and Settings controls and uses the shared 20 px icon for its Settings gear. The Animation label wraps to its own row through 368 px to leave room for the longest option and the custom chevron.

## Files changed

- `src/components/hero/Hero.astro`
- `src/components/explorer/Explorer.astro`

## Verification

- ✅ `npx prettier --check src/components/hero/Hero.astro src/components/explorer/Explorer.astro`
- ✅ `git diff --check -- src/components/hero/Hero.astro src/components/explorer/Explorer.astro`
- ✅ The select and button use the same toolbar minimum. Explorer selects use the shared 36 px minimum. All three inherit the shared 16 px coarse-pointer font.
- ✅ IBM Plex Sans advance widths put “Random rivers” at about 104 px at 16 px. With 40 px of horizontal padding, the borders, and the 20 px gear, the estimated select text area is 133 px at 320 px and 109 px at 369 px, the first whole-pixel width above the wrap breakpoint.

Control coordinated the shared styles and regression coverage. The independent checker will run browser tests.
