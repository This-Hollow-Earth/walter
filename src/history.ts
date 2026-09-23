// Computed edition-diffing: movement, Movers, and per-blip history.
// Replaces the hand-authored Blip.movement / Blip.previous_ring fields (THI-105).
import type { Blip, Edition, RingId } from "./types";
import { RINGS } from "./types";

export type Movement = "new" | "in" | "out" | "none";

const rank = (ringId: RingId) => RINGS.findIndex((r) => r.id === ringId);

/**
 * A blip's movement relative to the immediately preceding edition in
 * chronological order (regardless of whether the blip appeared in it).
 * `previous` is null for the oldest edition currently visible (no prior
 * edition to diff against) -- every blip in it reads as "new".
 */
export function computeMovement(blip: Blip, previous: Edition | null): { movement: Movement; previousRing: RingId | null } {
  const prev = previous?.blips.find((b) => b.id === blip.id);
  if (!prev) return { movement: "new", previousRing: null };
  const cur = rank(blip.ring);
  const old = rank(prev.ring);
  if (cur < old) return { movement: "in", previousRing: prev.ring };
  if (cur > old) return { movement: "out", previousRing: prev.ring };
  return { movement: "none", previousRing: prev.ring };
}

/** Precompute movement for every blip in `edition`, keyed by blip id. */
export function movementMap(edition: Edition, previous: Edition | null): Map<string, { movement: Movement; previousRing: RingId | null }> {
  return new Map(edition.blips.map((b) => [b.id, computeMovement(b, previous)]));
}

/** The dated event (if any) whose date falls inside `edition`'s own quarter. */
export function eventInEditionQuarter(blip: Blip, edition: Edition): string | null {
  const m = /^(\d{4})-q([1-4])$/.exec(edition.edition.id);
  if (!m) return null;
  const year = Number(m[1]);
  const q = Number(m[2]);
  const startMonth = (q - 1) * 3;
  const start = Date.UTC(year, startMonth, 1);
  const end = Date.UTC(year, startMonth + 3, 1);
  const hit = (blip.events ?? []).find((e) => {
    const t = Date.parse(e.date);
    return !Number.isNaN(t) && t >= start && t < end;
  });
  return hit?.summary ?? null;
}

export type MoverKind = "new" | "in" | "out" | "retired";

export interface MoverRow {
  blip: Blip;
  kind: MoverKind;
  fromRing: RingId | null;
  toRing: RingId | null;
  reason: string | null;
}

/** New / moved in / moved out / retired blips between two editions (from -> to). `from` may be null. */
export function computeMovers(from: Edition | null, to: Edition): MoverRow[] {
  const rows: MoverRow[] = [];
  const fromById = new Map((from?.blips ?? []).map((b) => [b.id, b]));
  const toIds = new Set(to.blips.map((b) => b.id));

  for (const b of to.blips) {
    const prev = fromById.get(b.id);
    const reason = eventInEditionQuarter(b, to);
    if (!prev) {
      rows.push({ blip: b, kind: "new", fromRing: null, toRing: b.ring, reason });
      continue;
    }
    const cur = rank(b.ring);
    const old = rank(prev.ring);
    if (cur < old) rows.push({ blip: b, kind: "in", fromRing: prev.ring, toRing: b.ring, reason });
    else if (cur > old) rows.push({ blip: b, kind: "out", fromRing: prev.ring, toRing: b.ring, reason });
  }
  if (from) {
    for (const b of from.blips) {
      if (!toIds.has(b.id)) rows.push({ blip: b, kind: "retired", fromRing: b.ring, toRing: null, reason: null });
    }
  }
  return rows;
}

export interface HistoryRow {
  editionId: string;
  label: string;
  ring: RingId;
  evidence: string;
  movement: Movement;
  reason: string | null;
}

/** One row per edition (chronological order, oldest first) in which `blipId` appears. */
export function blipHistory(blipId: string, editionsChrono: Edition[]): HistoryRow[] {
  const rows: HistoryRow[] = [];
  let previous: Edition | null = null;
  for (const ed of editionsChrono) {
    const b = ed.blips.find((x) => x.id === blipId);
    if (b) {
      const { movement } = computeMovement(b, previous);
      rows.push({
        editionId: ed.edition.id,
        label: ed.edition.label,
        ring: b.ring,
        evidence: b.evidence,
        movement,
        reason: eventInEditionQuarter(b, ed),
      });
    }
    previous = ed;
  }
  return rows;
}
