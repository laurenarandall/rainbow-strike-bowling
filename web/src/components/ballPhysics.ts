// Bowling-ball/lane contact model (no Babylon imports, unit-testable).
// The lane is oiled for the first part, dry near the pins. Sliding friction
// at the contact point turns side rotation into hook: skid -> hook -> roll.

/** World units per real metre. Lane width 1.054 m -> 5 units. */
export const S = 4.75;
export const GRAVITY = 9.81 * S;
export const BALL_R = 0.1085 * S;
export const FOUL_Z = 5;
export const PIN_Z_START = -50;
export const OIL_END_Z = FOUL_Z - 0.62 * (FOUL_Z - PIN_Z_START);
export const MU_OIL = 0.04;
export const MU_DRY = 0.2;
/** Max side rotation (rad/s) at full spin with hook = 1. */
export const REV_RATE = 30;

export interface Vec3Like {
  x: number;
  y: number;
  z: number;
}

export function laneFriction(z: number): number {
  return z > OIL_END_Z ? MU_OIL : MU_DRY;
}

/**
 * Apply one step of contact friction to linear (v) and angular (w) velocity.
 * Solid-sphere inertia (I = 0.4 m R^2): slip changes 3.5x faster than v.
 * Returns the remaining slip speed.
 */
export function applyContactFriction(v: Vec3Like, w: Vec3Like, mu: number, dt: number, R = BALL_R, g = GRAVITY): number {
  const ux = v.x + w.z * R;
  const uz = v.z - w.x * R;
  const slip = Math.hypot(ux, uz);
  if (slip < 1e-5) return 0;
  const j = Math.min(mu * g * dt, slip / 3.5);
  const fx = (-j * ux) / slip;
  const fz = (-j * uz) / slip;
  v.x += fx;
  v.z += fz;
  w.x += -fz / (0.4 * R);
  w.z += fx / (0.4 * R);
  return slip - 3.5 * j;
}

/** Initial velocities for a throw. spin in [-1,1]; positive hooks to -X (camera right). */
export function releaseState(speed: number, angle: number, spin: number, hook: number) {
  const v = { x: Math.sin(angle) * speed, y: 0, z: -Math.cos(angle) * speed };
  // Released skidding: only ~25% of full forward roll, plus side rotation.
  const w = { x: 0.25 * (v.z / BALL_R), y: 0, z: spin * hook * REV_RATE };
  return { v, w };
}

/** Predict the path to the pins (no collisions). Returns xz points. */
export function predictPath(x0: number, speed: number, angle: number, spin: number, hook: number, halfWidth: number, steps = 48): { x: number; z: number; gutter: boolean }[] {
  const { v, w } = releaseState(speed, angle, spin, hook);
  let x = x0;
  let z = FOUL_Z;
  const out: { x: number; z: number; gutter: boolean }[] = [];
  const dt = 1 / 120;
  const every = Math.max(1, Math.floor(((FOUL_Z - PIN_Z_START) / speed / dt) / steps));
  let i = 0;
  let gutter = false;
  while (z > PIN_Z_START && i < 4000) {
    if (!gutter) applyContactFriction(v, w, laneFriction(z), dt);
    x += v.x * dt;
    z += v.z * dt;
    if (Math.abs(x) > halfWidth) gutter = true;
    if (i % every === 0) out.push({ x, z, gutter });
    if (gutter) break;
    i++;
  }
  out.push({ x, z, gutter });
  return out;
}
