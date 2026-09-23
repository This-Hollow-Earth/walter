// Types mirror the blip schema v0.1 (Obsidian: WALTER/prototypes/Blip schema v0.1 - prototype.md)

export type QuadrantId = "rules" | "conditions" | "intelligence" | "responses";
export type RingId = "adopt" | "trial" | "assess" | "caution";
export type Movement = "new" | "in" | "out" | "none";
export type Evidence = "E1" | "E2" | "E3" | "E4" | "E5";
export type Level = "low" | "medium" | "high";
export type Clock = "business" | "political" | "infrastructure" | "cultural" | "natural";

export interface Source {
  title: string;
  url?: string | null;
  publisher?: string;
  type: "primary" | "secondary" | "dataset" | "analyst-judgement";
  accessed?: string;
}

export interface BlipEvent {
  date: string;
  type: "milestone" | "delay" | "amendment" | "release" | "retirement" | "evidence";
  summary: string;
  affects?: string[];
}

export interface Blip {
  id: string;
  name: string;
  quadrant: QuadrantId;
  ring: RingId;
  movement: Movement;
  previous_ring: RingId | null;
  evidence: Evidence;
  severity?: Level | null;
  dominant_clock?: Clock | null;
  scope: {
    commodities: string[];
    issues: string[];
    origins?: { political?: string[]; ecological?: string[] };
    horizon: string[];
  };
  uncertainty?: { spatial_resolution?: string | null; attribution_confidence?: Level | null };
  summary: string;
  rationale: string;
  actions: string[];
  sources: Source[];
  related?: string[];
  lifecycle?: { since?: string | null; until?: string | null; first_edition?: string };
  events?: BlipEvent[];
  draft?: boolean;
}

export interface Edition {
  edition: { id: string; label: string; published?: string | null; status?: string };
  blips: Blip[];
}

export const QUADRANTS: { id: QuadrantId; name: string; subtitle: string; index: 0 | 1 | 2 | 3 }[] = [
  { id: "rules", name: "Rules", subtitle: "Rules & Frameworks", index: 2 },
  { id: "conditions", name: "Conditions", subtitle: "Environmental Conditions", index: 3 },
  { id: "intelligence", name: "Intelligence", subtitle: "Data & Intelligence", index: 1 },
  { id: "responses", name: "Responses", subtitle: "Responses & Methods", index: 0 },
];

export const RINGS: { id: RingId; name: string; meaning: string }[] = [
  { id: "adopt", name: "ADOPT", meaning: "Build it into normal practice now." },
  { id: "trial", name: "TRIAL", meaning: "Test it this year in a bounded pilot." },
  { id: "assess", name: "ASSESS", meaning: "Brief the team, track it, set a decision point." },
  { id: "caution", name: "CAUTION", meaning: "Don't use it as a primary decision input." },
];

export const EVIDENCE: Record<Evidence, string> = {
  E1: "Emerging",
  E2: "Corroborated",
  E3: "Operational",
  E4: "Established",
  E5: "Institutionalised",
};

export const MOVEMENT: Record<Movement, { label: string; symbol: string }> = {
  new: { label: "New", symbol: "◉" },
  in: { label: "Moved in", symbol: "▲" },
  out: { label: "Moved out", symbol: "▼" },
  none: { label: "No change", symbol: "●" },
};
