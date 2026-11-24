import { Flood } from './flood.ts';
import type { Bar, H0Options, H0Result } from './types.ts';

/**
 * 0-dimensional persistent homology of the sublevel-set filtration of a W×H height grid
 * (spec §6.1). Cell index i = y·W + x, row 0 north. Ties are broken by (height, index).
 */
export function computeH0(
  heights: Float32Array,
  W: number,
  H: number,
  opts: H0Options = {},
): H0Result {
  const flood = new Flood(heights, W, H, { connectivity: opts.connectivity ?? 4 });
  const bars: Bar[] = [];
  const zeroLength: Bar[] = [];
  let births = 0;
  flood.sweepAll((kind, cell, lake, into) => {
    if (kind === 0) {
      births++;
      return;
    }
    const bar: Bar = {
      birth: heights[lake],
      death: heights[cell],
      birthCell: lake,
      deathCell: cell,
      mergedInto: into,
    };
    if (bar.death > bar.birth) bars.push(bar);
    else zeroLength.push(bar);
  });
  const finite = bars.length + zeroLength.length;
  // Surviving roots are the essential classes; report them in ≺ order of their birth cells.
  let essential = 0;
  for (let k = 0; k < flood.n; k++) {
    const i = flood.order[k];
    if (flood.componentOf(i) === i) {
      bars.push({
        birth: heights[i],
        death: Infinity,
        birthCell: i,
        deathCell: -1,
        mergedInto: -1,
      });
      essential++;
    }
  }
  return {
    bars,
    zeroLength,
    order: flood.order,
    rank: flood.rank,
    stats: {
      cells: flood.n,
      connectivity: flood.connectivity,
      births,
      finite,
      zeroLength: zeroLength.length,
      essential,
    },
  };
}

/** True for bars with death = +∞. */
export function isEssential(bar: Bar): boolean {
  return bar.death === Infinity;
}

/** death − birth (Infinity for essential bars). */
export function persistence(bar: Bar): number {
  return bar.death - bar.birth;
}

/** All finite bars (display + zero-length) in sweep order, for comparisons and debugging. */
export function allFiniteBars(result: H0Result): Bar[] {
  const out: Bar[] = [];
  const rank = result.rank;
  const finite = result.bars.filter((b) => !isEssential(b));
  let a = 0;
  let z = 0;
  const zl = result.zeroLength;
  const key = (b: Bar) => rank[b.deathCell] * result.order.length + rank[b.birthCell];
  while (a < finite.length || z < zl.length) {
    if (z >= zl.length || (a < finite.length && key(finite[a]) < key(zl[z]))) out.push(finite[a++]);
    else out.push(zl[z++]);
  }
  return out;
}
