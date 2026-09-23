import "./style.css";
import type { Blip } from "./types";
import { RINGS } from "./types";
import { INK, PAPER, esc, loadEdition, numbered, quadrantNamesByIndex, ringNames, toEntries } from "./data";
import { renderRadar } from "./radar";
import { detailHTML, editionLabel, legendHTML } from "./views";

type FilterKey = "commodity" | "origin" | "issue" | "ring";
const filters: Record<FilterKey, string> = { commodity: "", origin: "", issue: "", ring: "" };

const $ = <T extends Element>(sel: string) => document.querySelector<T>(sel)!;

async function main() {
  const ed = await loadEdition();
  const blips = ed.blips;
  const nums = numbered(blips);
  const byId = new Map(blips.map((b) => [b.id, b]));
  let selected: string | null = null;

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

  const select = (key: string | null) => {
    selected = key && byId.has(key) ? key : null;
    if (selected && location.hash !== `#${selected}`) history.replaceState(null, "", `#${selected}`);
    if (!selected && location.hash) history.replaceState(null, "", location.pathname);
    render();
  };

  function render() {
    renderRadar({
      svg: $<SVGSVGElement>("#radar"),
      quadrants: quadrantNamesByIndex(),
      rings: ringNames(),
      entries: toEntries(blips, nums, active),
      ink: INK,
      paper: PAPER,
      selected,
      onSelect: select,
    });
    $("#legend").innerHTML = legendHTML(blips, nums, active, selected);
    const n = blips.filter(active).length;
    $("#count").textContent = `${n} of ${blips.length} blips`;
    const panel = $("#detail");
    panel.innerHTML = selected
      ? `<button class="close" id="close" aria-label="Close">×</button>` + detailHTML(byId.get(selected)!, nums.get(selected), byId, nums)
      : `<p class="hint">Select a blip on the radar or in the legend to see why it sits in its ring, what to do, and the sources.</p>`;
    $("#close")?.addEventListener("click", () => select(null));
  }

  // delegated clicks for legend / related links
  document.addEventListener("click", (ev) => {
    const a = (ev.target as Element).closest<HTMLAnchorElement>("a[data-key]");
    if (!a) return;
    ev.preventDefault();
    select(a.dataset.key!);
  });
  window.addEventListener("hashchange", () => select(location.hash.slice(1) || null));

  selected = byId.has(location.hash.slice(1)) ? location.hash.slice(1) : null;
  render();
}

const uniq = (xs: string[]) => [...new Set(xs)].sort();

main().catch((err) => {
  console.error(err);
  $("#app-error").textContent = String(err);
});
