import yaml from "js-yaml";
import type { Blip, Edition, EditionManifest, EditionMeta } from "./types";
import { QUADRANTS, RINGS } from "./types";
import type { RadarEntry, Moved, Quadrant, Ring } from "./radar";
import { computeMovement } from "./history";

export const INK = "#434343";
export const PAPER = "#f5f5f5";

const editionCache = new Map<string, Promise<Edition>>();
let manifestCache: Promise<EditionManifest> | null = null;

/** Fetch and parse one edition file, with validation. Cached per session. */
export function loadEdition(id: string): Promise<Edition> {
  let p = editionCache.get(id);
  if (!p) {
    p = fetch(`${import.meta.env.BASE_URL}data/${id}.yaml`).then(async (res) => {
      if (!res.ok) throw new Error(`Could not load data/${id}.yaml (${res.status})`);
      const data = yaml.load(await res.text()) as Edition;
      validate(data);
      return data;
    });
    editionCache.set(id, p);
  }
  return p;
}

/** Fetch the edition manifest once per session. */
export function loadManifest(): Promise<EditionManifest> {
  if (!manifestCache) {
    manifestCache = fetch(`${import.meta.env.BASE_URL}data/editions.yaml`).then(async (res) => {
      if (!res.ok) throw new Error(`Could not load data/editions.yaml (${res.status})`);
      const data = yaml.load(await res.text()) as EditionManifest;
      validateManifest(data);
      return data;
    });
  }
  return manifestCache;
}

/** `?internal=1` in the URL unlocks non-public (historical-reconstruction) editions in the selector. */
export function isInternalUnlocked(): boolean {
  return new URLSearchParams(location.search).get("internal") === "1";
}

/** Editions visible in the current build's selector: all of them if unlocked, else only `public: true`. */
export function visibleEditions(manifest: EditionManifest): EditionMeta[] {
  return isInternalUnlocked() ? manifest.editions : manifest.editions.filter((e) => e.public);
}

/** The manifest's default edition: the latest visible one (manifest order = chronological). */
export function defaultEditionId(manifest: EditionManifest): string {
  const visible = visibleEditions(manifest);
  return visible[visible.length - 1]?.id ?? manifest.editions[manifest.editions.length - 1]?.id;
}

/** The edition immediately before `id` in the manifest's chronological order, or null if `id` is first / unknown. */
export function previousEditionId(manifest: EditionManifest, id: string): string | null {
  const idx = manifest.editions.findIndex((e) => e.id === id);
  return idx > 0 ? manifest.editions[idx - 1].id : null;
}

const MOVED: Record<ReturnType<typeof computeMovement>["movement"], Moved> = { new: 2, in: 1, out: -1, none: 0 };

/** Numbering follows the reading order: quadrant (Rules, Conditions, Intelligence, Responses) → ring → name. */
export function numbered(blips: Blip[]): Map<string, number> {
  const order = (b: Blip) => [QUADRANTS.findIndex((q) => q.id === b.quadrant), RINGS.findIndex((r) => r.id === b.ring)];
  const sorted = [...blips].sort((a, b) => {
    const [qa, ra] = order(a);
    const [qb, rb] = order(b);
    return qa - qb || ra - rb || a.name.localeCompare(b.name);
  });
  return new Map(sorted.map((b, i) => [b.id, i + 1]));
}

export function toEntries(
  blips: Blip[],
  nums: Map<string, number>,
  isActive: (b: Blip) => boolean,
  previous: Edition | null = null,
): RadarEntry[] {
  return blips.map((b) => ({
    key: b.id,
    num: nums.get(b.id)!,
    label: b.name,
    quadrant: QUADRANTS.find((q) => q.id === b.quadrant)!.index as Quadrant,
    ring: RINGS.findIndex((r) => r.id === b.ring) as Ring,
    moved: MOVED[computeMovement(b, previous).movement],
    active: isActive(b),
  }));
}

/** radar.js indexes quadrants by screen position; supply names in that order. */
export function quadrantNamesByIndex(): { name: string }[] {
  const names: { name: string }[] = [];
  for (const q of QUADRANTS) names[q.index] = { name: q.name.toUpperCase() };
  return names;
}

/** Find the QuadrantId whose screen position (radar.js index) matches `index`. */
export function quadrantByScreenIndex(index: number) {
  return QUADRANTS.find((q) => q.index === index)!;
}

export const ringNames = () => RINGS.map((r) => ({ name: r.name }));

function validate(data: Edition): void {
  const ids = new Set<string>();
  for (const b of data.blips) {
    if (ids.has(b.id)) throw new Error(`Duplicate blip id: ${b.id}`);
    ids.add(b.id);
    if (!QUADRANTS.some((q) => q.id === b.quadrant)) throw new Error(`${b.id}: unknown quadrant ${b.quadrant}`);
    if (!RINGS.some((r) => r.id === b.ring)) throw new Error(`${b.id}: unknown ring ${b.ring}`);
    if (b.severity && b.quadrant !== "conditions") console.warn(`${b.id}: severity is only meant for Conditions blips`);
    if ((b.sources?.length ?? 0) < 2) console.warn(`${b.id}: fewer than 2 sources (editorial bar)`);
  }
}

function validateManifest(data: EditionManifest): void {
  const ids = new Set<string>();
  for (const e of data.editions) {
    if (ids.has(e.id)) throw new Error(`Duplicate edition id in manifest: ${e.id}`);
    ids.add(e.id);
  }
}

export function esc(s: unknown): string {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
