import "./style.css";
import type { Blip, QuadrantId } from "./types";
import { QUADRANTS, RINGS } from "./types";
import { INK, PAPER, esc, loadEdition, numbered, quadrantByScreenIndex, quadrantNamesByIndex, ringNames, toEntries } from "./data";
import { renderRadar } from "./radar";
import type { Quadrant } from "./radar";
import { editionLabel, legendHTML, quadrantListHTML } from "./views";

type FilterKey = "commodity" | "origin" | "issue" | "ring";
const filters: Record<FilterKey, string> = { commodity: "", origin: "", issue: "", ring: "" };

const $ = <T extends Element>(sel: string) => document.querySelector<T>(sel)!;
const QUADRANT_IDS = new Set<string>(QUADRANTS.map((q) => q.id));

interface ViewState {
  quadrant: QuadrantId | null; // null = full radar overview (all 4 quadrants)
  blip: string | null; // the blip expanded in place, in the quadrant list or the overview legend
}

/** "#<quadrant>/<blip>" when zoomed with a blip open, "#<quadrant>" when zoomed,
 * bare "#<blip>" on the overview with a blip expanded, "#" otherwise. */
function hashFor(s: ViewState): string {
  if (s.quadrant && s.blip) return `#${s.quadrant}/${s.blip}`;
  if (s.quadrant) return `#${s.quadrant}`;
  if (s.blip) return `#${s.blip}`;
  return "#";
}

async function main() {
  const ed = await loadEdition();
  const blips = ed.blips;
  const nums = numbered(blips);
  const byId = new Map(blips.map((b) => [b.id, b]));
  let state: ViewState = { quadrant: null, blip: null };

  $("#edition").innerHTML = editionLabel(ed);

  // filter options from the data
  const origins = (b: Blip) => [...(b.scope.origins?.political ?? []), ...(b.scope.origins?.ecological ?? [])];
  const options: Record<FilterKey, string[]> = {
    commodity: uniq(blips.flatMap((b) => b.scope.commodities)),
    origin: uniq(blips.flatMap(origins)),
    issue: uniq(blips.flatMap((b) => b.scope.issues)),
    ring: RINGS.map((r) => r.id),
  };
  for (const key of Object.keys(options) as FilterKey[]) {
    const sel = $<HTMLSelectElement>(`#f-${key}`);
    sel.innerHTML =
      `<option value="">All</option>` +
      options[key].map((v) => `<option value="${esc(v)}">${esc(key === "ring" ? v.toUpperCase() : v)}</option>`).join("");
    sel.addEventListener("change", () => {
      filters[key] = sel.value;
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

  const active = (b: Blip) =>
    (!filters.commodity || b.scope.commodities.includes(filters.commodity)) &&
    (!filters.origin || origins(b).includes(filters.origin)) &&
    (!filters.issue || b.scope.issues.includes(filters.issue)) &&
    (!filters.ring || b.ring === filters.ring);

  /**
   * Parse the hash into a ViewState. Formats: "", "<blipId>" (overview,
   * expanded in its own quadrant column), "<quadrantId>" (zoomed),
   * "<quadrantId>/<blipId>" (zoomed, expanded).
   */
  function parseHash(): ViewState {
    const raw = location.hash.slice(1);
    if (!raw) return { quadrant: null, blip: null };
    const [a, b] = raw.split("/");
    if (QUADRANT_IDS.has(a)) return { quadrant: a as QuadrantId, blip: b && byId.has(b) ? b : null };
    if (byId.has(a)) return { quadrant: null, blip: a };
    return { quadrant: null, blip: null };
  }

  function go(next: ViewState) {
    state = next;
    const h = hashFor(state);
    if (location.hash !== h) history.pushState(null, "", h === "#" ? location.pathname : h);
    render();
  }

  const selectBlip = (key: string | null) => go({ quadrant: state.quadrant, blip: key });
  const selectQuadrant = (screenIndex: Quadrant) => go({ quadrant: quadrantByScreenIndex(screenIndex).id, blip: null });
  const backToOverview = () => go({ quadrant: null, blip: null });
  const backToQuadrant = () => go({ quadrant: state.quadrant, blip: null });
  const enterAndSelect = (q: QuadrantId, blip: string) => go({ quadrant: q, blip });

  function render() {
    const zoomedIdx = state.quadrant ? (QUADRANTS.find((q) => q.id === state.quadrant)!.index as Quadrant) : null;
    renderRadar({
      svg: $<SVGSVGElement>("#radar"),
      quadrants: quadrantNamesByIndex(),
      rings: ringNames(),
      entries: toEntries(blips, nums, active),
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
      side.innerHTML = quadrantListHTML(state.quadrant, blips, nums, active, byId, state.blip);
    } else {
      side.className = "legend" + (state.blip ? " has-expanded" : "");
      side.innerHTML = legendHTML(blips, nums, active, byId, state.blip);
    }

    const n = blips.filter(active).length;
    $("#count").textContent = `${n} of ${blips.length} blips`;

    // scroll whichever expanded card exists into view
    document.querySelector(".expanded")?.scrollIntoView({ block: "nearest" });
  }

  // delegated clicks: legend rows, quadrant-list rows, related links, and nav buttons
  document.addEventListener("click", (ev) => {
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
    const target = byId.get(targetId);
    if (a.dataset.quadrant) {
      // a zoomed quadrant-list row: enter/stay in that quadrant and expand the blip
      enterAndSelect(a.dataset.quadrant as QuadrantId, targetId);
    } else if (state.quadrant && target && target.quadrant !== state.quadrant) {
      // a "related" link, while zoomed, that crosses into a different quadrant
      enterAndSelect(target.quadrant, targetId);
    } else {
      // overview legend rows, and related links that stay within the current context
      selectBlip(targetId);
    }
  });

  window.addEventListener("popstate", () => {
    state = parseHash();
    render();
  });

  state = parseHash();
  render();
}

const uniq = (xs: string[]) => [...new Set(xs)].sort();

main().catch((err) => {
  console.error(err);
  $("#app-error").textContent = String(err);
});
