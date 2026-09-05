import { UPGRADE_EFFECTS } from '../data/research.js';

const clamp100 = n => Math.max(0, Math.min(100, Math.round(n)));

/* Tolerance windows are "oil", not "juice" — the coyote-time family.
   Forgiving by default; mastery is hitting perfect, not avoiding failure. */

export function scorePour(volume, target, band) {
  const dev = Math.abs(volume - target);
  if (dev <= band) return 100;
  const falloff = band * 3;
  return clamp100(100 * (1 - (dev - band) / falloff));
}

export function scoreFlip(msOffset, windowMs) {
  const dev = Math.abs(msOffset);
  if (dev <= windowMs) return 100;
  const falloff = windowMs * 4;
  return clamp100(100 * (1 - (dev - windowMs) / falloff));
}

/* Stack error COMPOUNDS. `offsets` are DELTAS from the previous pancake, so
   they accumulate into a running position and the score is the average
   distance from centre across the whole stack. An off-centre first pancake
   therefore costs for every pancake above it — but a steady hand CAN nurse
   the tower back, and that recovery is deliberate: [+8, -8] scores better
   than [+8, 0]. Callers must emit deltas, not absolute positions; emitting
   absolutes silently inverts the beat (a zig-zag outscores a straight tower). */
export function scoreStack(offsets, driftScale = 1) {
  if (!offsets || offsets.length === 0) return 100;
  let drift = 0, penalty = 0;
  for (const o of offsets) {
    drift += o;
    penalty += Math.abs(drift);
  }
  const avgDrift = (penalty / offsets.length) * driftScale;
  return clamp100(100 - avgDrift * 2);
}

/* Coverage is an array of cell fill values 0..1 across the stack's top.
   Ideal is even and generous without pooling. */
export function scoreDrizzle(coverage) {
  if (!coverage || coverage.length === 0) return 0;
  const n = coverage.length;
  const mean = coverage.reduce((a, b) => a + b, 0) / n;
  const variance = coverage.reduce((a, c) => a + (c - mean) ** 2, 0) / n;
  const bare = coverage.filter(c => c < 0.1).length / n;
  const pooled = coverage.filter(c => c > 0.95).length / n;
  const thin = mean < 0.3 ? (0.3 - mean) * 100 : 0;
  return clamp100(100 - variance * 200 - bare * 60 - pooled * 40 - thin);
}

export function effectsFor(upgrades = []) {
  const out = { pourBandPlus: 0, flipWindowPlus: 0, stackDriftScale: 1 };
  for (const id of upgrades) {
    const eff = UPGRADE_EFFECTS[id];
    if (!eff) continue;
    if (eff.pourBandPlus) out.pourBandPlus += eff.pourBandPlus;
    if (eff.flipWindowPlus) out.flipWindowPlus += eff.flipWindowPlus;
    if (eff.stackDriftScale) out.stackDriftScale *= eff.stackDriftScale;
  }
  return out;
}

export function scoreDish(recipe, beats, upgrades = []) {
  const e = effectsFor(upgrades);
  const breakdown = {
    pour:    scorePour(beats.volume, recipe.pour.target, recipe.pour.band + e.pourBandPlus),
    flip:    scoreFlip(beats.msOffset, recipe.flip.windowMs + e.flipWindowPlus),
    stack:   scoreStack(beats.offsets, e.stackDriftScale),
    drizzle: scoreDrizzle(beats.coverage)
  };
  const w = recipe.weights;
  const total = w.pour + w.flip + w.stack + w.drizzle;
  const quality = clamp100(
    (breakdown.pour * w.pour + breakdown.flip * w.flip +
     breakdown.stack * w.stack + breakdown.drizzle * w.drizzle) / total
  );
  return { quality, breakdown };
}
