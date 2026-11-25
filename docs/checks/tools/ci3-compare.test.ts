// CI3 checker: run in a throwaway copy of the repo where src/lib/viz/explorer/labels-old.ts is
// `git show HEAD:src/lib/viz/explorer/labels.ts`. Not part of the repo's test suite.
// (a) Wherever HEAD placed every priority-1 label, the new layout must be identical.
// (b) New layout: P1 count never below HEAD; independent geometry invariants hold.
import { describe, expect, it } from 'vitest';
import labels from '../../../public/data/colorado/labels.json';
import meta from '../../../public/data/colorado/meta.json';
import measured from './ci3-widths.json';
import * as NEW from '../../../src/lib/viz/explorer/labels.ts';
import * as OLD from '../../../src/lib/viz/explorer/labels-old.ts';
import { displayAspect, gridGeo } from '../../../src/lib/viz/explorer/geo.ts';

type C = NEW.LabelCandidate;
type B = NEW.LabelBox;
const geo = gridGeo(meta as never);
const aspect = displayAspect(geo);
const places = (labels as NEW.PlaceLabelsFile).labels;

function rng(seed: number) {
  return () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

/** Independent checks (no helpers from labels.ts other than the box/candidate shapes). */
function violations(cs: C[], boxes: B[], W: number, H: number): string[] {
  const by = new Map(cs.map((c) => [c.id, c]));
  const v: string[] = [];
  const tip = (c: C, b: B) => ({
    x: Math.min(Math.max(c.x, b.left), b.left + b.width),
    y: Math.min(Math.max(c.y, b.top), b.top + b.height),
  });
  const seg = (a: { x: number; y: number }, t: { x: number; y: number }, b: B) => {
    let t0 = 0,
      t1 = 1;
    const dx = t.x - a.x,
      dy = t.y - a.y;
    for (const [p, q] of [
      [-dx, a.x - b.left],
      [dx, b.left + b.width - a.x],
      [-dy, a.y - b.top],
      [dy, b.top + b.height - a.y],
    ]) {
      if (p === 0) {
        if (q <= 0) return false;
      } else {
        const r = q / p;
        if (p < 0) t0 = Math.max(t0, r);
        else t1 = Math.min(t1, r);
        if (t0 >= t1) return false;
      }
    }
    return true;
  };
  for (const a of boxes) {
    const ca = by.get(a.id)!;
    if (a.left < 0 || a.top < 0 || a.left + a.width > W || a.top + a.height > H) v.push(`oob ${a.id}`);
    const ta = tip(ca, a);
    for (const b of boxes) {
      if (a === b) continue;
      if (a.left < b.left + b.width && b.left < a.left + a.width && a.top < b.top + b.height && b.top < a.top + a.height)
        v.push(`overlap ${a.id}/${b.id}`);
      const r = 3.25;
      if (ca.x + r > b.left && ca.x - r < b.left + b.width && ca.y + r > b.top && ca.y - r < b.top + b.height)
        v.push(`marker ${a.id} under ${b.id}`);
      if (seg(ca, ta, b)) v.push(`leader ${a.id} x ${b.id}`);
    }
  }
  // Every P1 marker (always drawn when placed) must not sit under any placard.
  return v;
}

const real = (W: number, H: number, table: Record<string, number>, s: number): C[] =>
  places.map((p) => ({
    id: p.id,
    priority: p.priority,
    x: ((p.lon - geo.west) / (geo.east - geo.west)) * W,
    y: ((geo.north - p.lat) / (geo.north - geo.south)) * H,
    textWidth: table[String(p.id)] * s,
  }));

const p1 = (cs: C[], bs: B[]) => {
  const ids = new Set(bs.map((b) => b.id));
  return cs.filter((c) => c.priority === 1 && ids.has(c.id)).length;
};

describe('CI3 checker', () => {
  it('real data: identical where HEAD succeeded; never fewer P1; invariants', () => {
    let same = 0,
      oldFail = 0,
      newFail = 0;
    const bad: string[] = [];
    let maxLeader = 0;
    for (const [font, table] of Object.entries(measured as Record<string, Record<string, number>>))
      for (let W = 250; W <= 1300; W += 3)
        for (const s of [0.9, 1, 1.1, 1.2, 1.3]) {
          const H = W / aspect;
          const cs = real(W, H, table, s);
          const o = OLD.placeLabelBoxes(cs, W, H);
          const n = NEW.placeLabelBoxes(cs, W, H);
          const total = cs.filter((c) => c.priority === 1).length;
          if (p1(cs, o) === total) {
            if (JSON.stringify(o) !== JSON.stringify(n)) bad.push(`diff ${font} ${W} ${s}`);
            same++;
          } else oldFail++;
          if (p1(cs, n) < p1(cs, o)) bad.push(`fewer P1 ${font} ${W} ${s}`);
          if (p1(cs, n) < total) newFail++;
          const v = violations(cs, n, W, H);
          if (v.length) bad.push(`${font} ${W} ${s}: ${v[0]}`);
          for (const b of n) {
            const c = cs.find((x) => x.id === b.id)!;
            const tx = Math.min(Math.max(c.x, b.left), b.left + b.width);
            const ty = Math.min(Math.max(c.y, b.top), b.top + b.height);
            maxLeader = Math.max(maxLeader, Math.hypot(tx - c.x, ty - c.y));
          }
        }
    console.log({ same, oldFail, newFail, maxLeader: maxLeader.toFixed(1), bad: bad.slice(0, 10), nbad: bad.length });
    expect(bad).toEqual([]);
  });

  it('random sets: identical where HEAD succeeded; never fewer P1; invariants', () => {
    let same = 0,
      oldFail = 0,
      newFail = 0,
      improved = 0;
    const bad: string[] = [];
    for (let seed = 1; seed <= 4000; seed++) {
      const r = rng(seed);
      const W = 80 + Math.floor(r() * 500),
        H = 80 + Math.floor(r() * 700);
      const n = 2 + Math.floor(r() * 30);
      const cs: C[] = Array.from({ length: n }, (_, k) => ({
        id: 1 + Math.floor(r() * 100000) * 100 + k,
        priority: 1 + Math.floor(r() * 3),
        x: r() * W,
        y: r() * H,
        textWidth: 20 + r() * 110,
      }));
      const o = OLD.placeLabelBoxes(cs, W, H);
      const nw = NEW.placeLabelBoxes(cs, W, H);
      const total = cs.filter((c) => c.priority === 1).length;
      if (p1(cs, o) === total) {
        same++;
        if (JSON.stringify(o) !== JSON.stringify(nw)) bad.push(`diff seed ${seed}`);
      } else {
        oldFail++;
        if (p1(cs, nw) > p1(cs, o)) improved++;
      }
      if (p1(cs, nw) < p1(cs, o)) bad.push(`fewer P1 seed ${seed}`);
      if (p1(cs, nw) < total) newFail++;
      const v = violations(cs, nw, W, H);
      if (v.length) bad.push(`seed ${seed}: ${v[0]}`);
      // determinism under input order
      if (JSON.stringify(NEW.placeLabelBoxes([...cs].reverse(), W, H)) !== JSON.stringify(nw))
        bad.push(`order-dependent seed ${seed}`);
    }
    console.log({ same, oldFail, improved, newFail, bad: bad.slice(0, 10), nbad: bad.length });
    expect(bad).toEqual([]);
  });
});
