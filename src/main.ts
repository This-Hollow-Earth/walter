import "./style.css";
import type { Blip, Edition, QuadrantId } from "./types";
import { QUADRANTS, RINGS } from "./types";
import {
  INK,
  PAPER,
  esc,
  loadEdition,
  loadManifest,
  numbered,
  quadrantByScreenIndex,
  quadrantNamesByIndex,
  ringNames,
  toEntries,
  visibleEditions,
  defaultEditionId,
  previousEditionId,
} from "./data";
import { renderRadar } from "./radar";
import type { Quadrant } from "./radar";
import { editionLabel, legendHTML, quadrantListHTML, moversHTML } from "./views";

type FilterKey = "commodity" | "origin" | "issue" | "ring";
const filters: Record<FilterKey, string> = { commodity: "", origin: "", issue: "", ring: "" };

const $ = <T extends Element>(sel: string) => document.querySelector<T>(sel)!;
const QUADRANT_IDS = new Set<string>(QUADRANTS.map((q) => q.id));

interface ViewState {
  editionId: string;
  view: "radar" | "movers";
  quadrant: QuadrantId | null; // null = full radar overview (all 4 quadrants)
  blip: string | null; // the blip expanded in place, in the quadrant list or the overview legend
}

/** "#<edition>/movers", "#<edition>/<quadrant>/<blip>", "#<edition>/<quadrant>", "#<edition>/<blip>", "#<edition>".
 * The edition segment is omitted when it's the manifest's default, so today's bare-hash links keep working. */
function hashFor(s: ViewState, defaultId: string): string {
  const prefix = s.editionId === defaultId ? "" : `${s.editionId}/`;
  if (s.view === "movers") return `#${prefix}movers`;
  if (s.quadrant && s.blip) return `#${prefix}${s.quadrant}/${s.blip}`;
  if (s.quadrant) return `#${prefix}${s.quadrant}`;
  if (s.blip) return `#${prefix}${s.blip}`;
  return prefix ? `#${prefix}` : "#";
}

async function main() {
  const manifest = await loadManifest();
  const defaultId = defaultEditionId(manifest);
  const editionCache = new Map<string, Edition>();

  async function getEdition(id: string): Promise<Edition> {
    let ed = editionCache.get(id);
    if (!ed) {
      ed = await loadEdition(id);
      editionCache.set(id, ed);
    }
    return ed;
  }

  // Preload the default edition so first paint doesn't need extra async plumbing.
  await getEdition(defaultId);

  const visible = visibleEditions(manifest);
  const editionSelect = $<HTMLSelectElement>("#f-edition");
  editionSelect.innerHTML = visible.map((e) => `<option value="${esc(e.id)}">${esc(e.label)}</option>`).join("");

  let state: ViewState = { editionId: defaultId, view: "radar", quadrant: null, blip: null };

  // filter options are derived from whichever edition is currently loaded
  const origins = (b: Blip) => [...(b.scope.origins?.political ?? []), ...(b.scope.origins?.ecological ?? [])];
  function refreshFilterOptions(blips: Blip[]) {
    const options: Record<FilterKey, string[]> = {
      commodity: uniq(blips.flatMap((b) => b.scope.commodities)),
      origin: uniq(blips.flatMap(origins)),
      issue: uniq(blips.flatMap((b) => b.scope.issues)),
      ring: RINGS.map((r) => r.id),
    };
    for (const key of Object.keys(options) as FilterKey[]) {
      const sel = $<HTMLSelectElement>(`#f-${key}`);
      const current = sel.value;
      sel.innerHTML =
        `<option value="">All</option>` +
        options[key].map((v) => `<option value="${esc(v)}">${esc(key === "ring" ? v.toUpperCase() : v)}</option>`).join("");
      sel.value = options[key].includes(current) ? current : "";
    }
  }
  for (const key of ["commodity", "origin", "issue", "ring"] as FilterKey[]) {
    $<HTMLSelectElement>(`#f-${key}`).addEventListener("change", (ev) => {
      filters[key] = (ev.target as HTMLSelectElement).value;
      render();
    });
  }
  $("#f-reset").addEventListener("click", () => {
    for (const k of Object.keys(filters) as FilterKey[]) {
      filters[k] = "";
      $<HTMLSelectElement>(`#f-${k}`).value = "";
    }
    render();
  });
  editionSelect.addEventListener("change", () => go({ ...state, editionId: editionSelect.value, quadrant: null, blip: null }));
  $("#edition-prev").addEventListener("click", () => stepEdition(-1));
  $("#edition-next").addEventListener("click", () => stepEdition(1));

  function stepEdition(dir: -1 | 1) {
    const idx = visible.findIndex((e) => e.id === state.editionId);
    const next = visible[idx + dir];
    if (next) go({ ...state, editionId: next.id, quadrant: null, blip: null });
  }

  const active = (b: Blip) =>
    (!filters.commodity || b.scope.commodities.includes(filters.commodity)) &&
    (!filters.origin || origins(b).includes(filters.origin)) &&
    (!filters.issue || b.scope.issues.includes(filters.issue)) &&
    (!filters.ring || b.ring === filters.ring);

  /**
   * Parse the hash into a ViewState. An optional leading `<editionId>/` segment
   * selects the edition (omitted = manifest default, keeping old links working).
   * Remaining formats: "", "movers", "<blipId>", "<quadrantId>", "<quadrantId>/<blipId>".
   * Blip/quadrant validity is checked against `byId`/`QUADRANT_IDS` for the resolved edition.
   */
  function parseHash(byId: Map<string, Blip>): ViewState {
    const raw = location.hash.slice(1);
    if (!raw) return { editionId: defaultId, view: "radar", quadrant: null, blip: null };
    const segments = raw.split("/");
    let editionId = defaultId;
    if (visible.some((e) => e.id === segments[0]) || manifest.editions.some((e) => e.id === segments[0])) {
      editionId = segments.shift()!;
    }
    const rest = segments;
    if (rest[0] === "movers") return { editionId, view: "movers", quadrant: null, blip: null };
    const [a, b] = rest;
    if (QUADRANT_IDS.has(a)) return { editionId, view: "radar", quadrant: a as QuadrantId, blip: b && byId.has(b) ? b : null };
    if (a && byId.has(a)) return { editionId, view: "radar", quadrant: null, blip: a };
    return { editionId, view: "radar", quadrant: null, blip: null };
  }

  function go(next: ViewState) {
    state = next;
    const h = hashFor(state, defaultId);
    if (location.hash !== h) history.pushState(null, "", h === "#" ? location.pathname : h);
    render();
  }

  const selectBlip = (key: string | null) => go({ ...state, view: "radar", blip: key });
  const selectQuadrant = (screenIndex: Quadrant) => go({ ...state, view: "radar", quadrant: quadrantByScreenIndex(screenIndex).id, blip: null });
  const backToOverview = () => go({ ...state, view: "radar", quadrant: null, blip: null });
  const backToQuadrant = () => go({ ...state, view: "radar", blip: null });
  const enterAndSelect = (q: QuadrantId, blip: string) => go({ ...state, view: "radar", quadrant: q, blip });
  const openMovers = () => go({ ...state, view: "movers", quadrant: null, blip: null });

  async function render() {
    const ed = await getEdition(state.editionId);
    const blips = ed.blips;
    const nums = numbered(blips);
    const byId = new Map(blips.map((b) => [b.id, b]));

    // if the hash referenced a blip/edition we hadn't loaded yet, re-validate now that we have real data
    const reparsed = parseHash(byId);
    if (reparsed.editionId === state.editionId && (reparsed.blip !== state.blip || reparsed.quadrant !== state.quadrant)) {
      // hash had a blip id not valid in a *different* previously-assumed edition; trust the freshly parsed state
      state = { ...state, quadrant: reparsed.quadrant, blip: reparsed.blip };
    }

    refreshFilterOptions(blips);
    editionSelect.value = state.editionId;
    const idx = visible.findIndex((e) => e.id === state.editionId);
    $<HTMLButtonElement>("#edition-prev").disabled = idx <= 0;
    $<HTMLButtonElement>("#edition-next").disabled = idx === -1 || idx >= visible.length - 1;

    const prevId = previousEditionId(manifest, state.editionId);
    const previous = prevId ? await getEdition(prevId) : null;
    const allEditionsChrono = manifest.editions.map((e) => editionCache.get(e.id)).filter((e): e is Edition => !!e);

    $("#edition").innerHTML = editionLabel(ed);
    const banner = $("#edition-banner");
    banner.innerHTML =
      ed.edition.status === "historical-reconstruction"
        ? `This edition is a retrospective reconstruction using information available as of the access date, not a live editorial call made at the time.`
        : "";

    const navMovers = $<HTMLAnchorElement>("#nav-movers");
    navMovers.setAttribute("aria-current", state.view === "movers" ? "page" : "false");

    if (state.view === "movers") {
      renderRadar({
        svg: $<SVGSVGElement>("#radar"),
        quadrants: quadrantNamesByIndex(),
        rings: ringNames(),
        entries: toEntries(blips, nums, active, previous),
        ink: INK,
        paper: PAPER,
        selected: null,
        onSelect: undefined,
        onSelectQuadrant: (screenIndex) => go({ ...state, view: "radar", quadrant: quadrantByScreenIndex(screenIndex).id, blip: null }),
        zoomedQuadrant: null,
      });
      $("#breadcrumb").innerHTML = `<button type="button" data-nav="overview">Radar</button> <span class="sep">/</span> <span>Movers</span>`;
      const side = $<HTMLElement>("#side");
      side.className = "movers-panel";
      const fromLabel = previous ? editionLabel(previous) : "(no earlier edition)";
      side.innerHTML =
        `<div class="movers-header"><h2>Movers</h2><p class="mv-range">${esc(fromLabel)} → ${esc(editionLabel(ed))}</p></div>` +
        moversHTML(previous, ed, nums);
      $("#count").textContent = "";
      document.querySelector(".expanded")?.scrollIntoView({ block: "nearest" });
      return;
    }
    const zoomedIdx = state.quadrant ? (QUADRANTS.find((q) => q.id === state.quadrant)!.index as Quadrant) : null;
    renderRadar({
      svg: $<SVGSVGElement>("#radar"),
      quadrants: quadrantNamesByIndex(),
      rings: ringNames(),
      entries: toEntries(blips, nums, active, previous),
      ink: INK,
      paper: PAPER,
      selected: state.blip,
      onSelect: selectBlip,
      onSelectQuadrant: state.quadrant ? undefined : selectQuadrant,
      zoomedQuadrant: zoomedIdx,
    });

    // breadcrumb: Radar / Quadrant [/ Blip name] — only appears once zoomed into a quadrant
    const breadcrumb = $("#breadcrumb");
    if (state.quadrant) {
      const qname = QUADRANTS.find((q) => q.id === state.quadrant)!.name;
      breadcrumb.innerHTML =
        `<button type="button" data-nav="overview">Radar</button> <span class="sep">/</span> ` +
        (state.blip
          ? `<button type="button" data-nav="quadrant">${esc(qname)}</button> <span class="sep">/</span> <span>${esc(byId.get(state.blip)?.name ?? "")}</span>`
          : `<span>${esc(qname)}</span>`);
    } else {
      breadcrumb.innerHTML = "";
    }

    // side panel: always visible, right column. Zoomed into a quadrant -> that quadrant's
    // drill-down list; overview -> the full blip legend (all 4 quadrants stacked in one
    // column). Same expand-in-place behaviour either way.
    const side = $<HTMLElement>("#side");
    if (state.quadrant) {
      side.className = "quadrant-panel" + (state.blip ? " has-expanded" : "");
      side.innerHTML = quadrantListHTML(state.quadrant, blips, nums, active, byId, state.blip, previous, allEditionsChrono);
    } else {
      side.className = "legend" + (state.blip ? " has-expanded" : "");
      side.innerHTML = legendHTML(blips, nums, active, byId, state.blip, previous, allEditionsChrono);
    }

    const n = blips.filter(active).length;
    $("#count").textContent = `${n} of ${blips.length} blips`;

    // scroll whichever expanded card exists into view
    document.querySelector(".expanded")?.scrollIntoView({ block: "nearest" });
  }

  // delegated clicks: legend rows, quadrant-list rows, related links, and nav buttons
  document.addEventListener("click", (ev) => {
    const moversLink = (ev.target as Element).closest<HTMLAnchorElement>("#nav-movers");
    if (moversLink) {
      ev.preventDefault();
      openMovers();
      return;
    }
    const nav = (ev.target as Element).closest<HTMLButtonElement>("button[data-nav]");
    if (nav) {
      ev.preventDefault();
      if (nav.dataset.nav === "overview") backToOverview();
      else backToQuadrant(); // also handles "collapse this expanded row" in both overview and zoomed contexts
      return;
    }
    const a = (ev.target as Element).closest<HTMLAnchorElement>("a[data-key]");
    if (!a) return;
    ev.preventDefault();
    const targetId = a.dataset.key!;
    if (a.dataset.quadrant) {
      // a zoomed quadrant-list row, or a Movers row: enter/stay in that quadrant and expand the blip
      enterAndSelect(a.dataset.quadrant as QuadrantId, targetId);
    } else if (state.quadrant) {
      // a "related" link, while zoomed: only cross quadrants if it actually points elsewhere
      const currentQuadrant = state.quadrant;
      getEdition(state.editionId).then((ed) => {
        const target = ed.blips.find((b) => b.id === targetId);
        if (target && target.quadrant !== currentQuadrant) enterAndSelect(target.quadrant, targetId);
        else selectBlip(targetId);
      });
    } else {
      // overview legend rows, and related links that stay within the current context
      selectBlip(targetId);
    }
  });

  window.addEventListener("popstate", async () => {
    const ed = await getEdition(state.editionId);
    state = parseHash(new Map(ed.blips.map((b) => [b.id, b])));
    render();
  });

  const initialEd = await getEdition(defaultId);
  state = parseHash(new Map(initialEd.blips.map((b) => [b.id, b])));
  await render();
}

const uniq = (xs: string[]) => [...new Set(xs)].sort();

main().catch((err) => {
  console.error(err);
  $("#app-error").textContent = String(err);
});
