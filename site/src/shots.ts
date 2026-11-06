import manifest from './shots.json';
import { ALT, type ShotId } from './content';

export type Shot = {
  id: ShotId;
  kind: 'desktop' | 'android';
  width: number;
  height: number;
  srcs: { w: number; url: string }[];
  alt: string;
};

type Entry = { width: number; height: number; srcs: { w: number; url: string }[] };
const entries = manifest as Record<string, Entry>;
const keys = Object.keys(entries);

/**
 * Finds the generated files for a screenshot. Desktop shots are matched by
 * their number (desktop/02-… matches any file named 02-*.png), so a renamed
 * file still works. Returns undefined when the screenshot is not added yet.
 */
export function getShot(id: ShotId): Shot | undefined {
  const [kind, name] = id.split('/') as ['desktop' | 'android', string];
  let key: string | undefined = id in entries ? id : undefined;
  if (!key && kind === 'desktop') {
    const num = name.slice(0, 2);
    key = keys.find((k) => k.startsWith(`desktop/${num}`));
  }
  if (!key) return undefined;
  const e = entries[key];
  return { id, kind, ...e, alt: ALT[id] };
}

/** The desktop shot if it exists, otherwise the Android fallback (if any), otherwise the desktop id (renders a placeholder). */
export function pick(id: ShotId, fallback?: ShotId): ShotId {
  return getShot(id) || !fallback ? id : fallback;
}

export function srcSet(shot: Shot) {
  return shot.srcs.map((s) => `${s.url} ${s.w}w`).join(', ');
}

export function largest(shot: Shot) {
  return shot.srcs[shot.srcs.length - 1].url;
}
