import type { Blip, Edition } from "./types";
import { EVIDENCE, MOVEMENT, QUADRANTS, RINGS } from "./types";
import { esc } from "./data";

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Legend: four quadrant columns, grouped by ring, numbered like the radar. */
export function legendHTML(blips: Blip[], nums: Map<string, number>, active: (b: Blip) => boolean, selected: string | null): string {
  return QUADRANTS.map((q) => {
    const rings = RINGS.map((r) => {
      const items = blips
        .filter((b) => b.quadrant === q.id && b.ring === r.id)
        .sort((a, b) => nums.get(a.id)! - nums.get(b.id)!);
      if (!items.length) return "";
      return `<h4>${r.name}</h4><ol>${items
        .map(
          (b) =>
            `<li class="${active(b) ? "" : "inactive"} ${b.id === selected ? "selected" : ""}">` +
            `<a href="#${esc(b.id)}" data-key="${esc(b.id)}"><span class="num">${nums.get(b.id)}</span> ${esc(b.name)}` +
            ` <span class="mv" title="${MOVEMENT[b.movement].label}">${MOVEMENT[b.movement].symbol}</span></a></li>`,
        )
        .join("")}</ol>`;
    }).join("");
    return `<section class="legend-q"><h3>${q.name}<small>${q.subtitle}</small></h3>${rings || '<p class="empty">No blips yet</p>'}</section>`;
  }).join("");
}

/** Full detail of one blip (side panel and print view). */
export function detailHTML(b: Blip, num: number | undefined, byId: Map<string, Blip>, nums: Map<string, number>): string {
  const q = QUADRANTS.find((x) => x.id === b.quadrant)!;
  const r = RINGS.find((x) => x.id === b.ring)!;
  const o = b.scope.origins ?? {};
  const facts: [string, string][] = [
    ["Quadrant", `${q.name} <small>(${q.subtitle})</small>`],
    ["Ring", `<strong>${r.name}</strong>: ${esc(r.meaning)}`],
    ["Movement", `${MOVEMENT[b.movement].symbol} ${MOVEMENT[b.movement].label}${b.previous_ring ? ` (was ${b.previous_ring.toUpperCase()})` : ""}`],
    ["Evidence", `${b.evidence} ${EVIDENCE[b.evidence]}`],
  ];
  if (b.severity) facts.push(["Severity", cap(b.severity)]);
  if (b.dominant_clock) facts.push(["Dominant clock", cap(b.dominant_clock)]);
  facts.push(["Commodities", b.scope.commodities.map(esc).join(", ") || "—"]);
  facts.push(["Issues", b.scope.issues.map(esc).join(", ") || "—"]);
  if (o.political?.length || o.ecological?.length)
    facts.push(["Origins", [...(o.political ?? []), ...(o.ecological ?? [])].map(esc).join(" · ")]);
  facts.push(["Horizon", b.scope.horizon.map(esc).join(", ")]);
  if (b.uncertainty?.spatial_resolution) facts.push(["Spatial resolution", esc(b.uncertainty.spatial_resolution)]);
  if (b.uncertainty?.attribution_confidence) facts.push(["Attribution confidence", cap(b.uncertainty.attribution_confidence)]);

  const lc = b.lifecycle ?? {};
  const events = [...(b.events ?? [])].sort((x, y) => x.date.localeCompare(y.date));
  const timeline =
    lc.since || events.length || lc.until
      ? `<h4>Lifecycle &amp; events</h4><ul class="timeline">
        ${lc.since ? `<li><time>${esc(lc.since)}</time> Came into existence</li>` : ""}
        ${events.map((e) => `<li><time>${esc(e.date)}</time> <em>${esc(e.type)}</em>: ${esc(e.summary)}</li>`).join("")}
        ${lc.until ? `<li><time>${esc(lc.until)}</time> Ends</li>` : ""}
      </ul>`
      : "";

  const related = (b.related ?? [])
    .filter((id) => byId.has(id))
    .map((id) => `<a href="#${esc(id)}" data-key="${esc(id)}">${nums.get(id)}. ${esc(byId.get(id)!.name)}</a>`)
    .join(" · ");

  return `
    <article class="blip-detail" id="detail-${esc(b.id)}">
      <header>
        <span class="num big">${num ?? ""}</span>
        <h2>${esc(b.name)}</h2>
        ${b.draft ? '<span class="tag">draft</span>' : ""}
      </header>
      <p class="summary">${esc(b.summary)}</p>
      <dl class="facts">${facts.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join("")}</dl>
      <h4>Why this ring</h4>
      <p>${esc(b.rationale)}</p>
      ${b.actions.length ? `<h4>What to do</h4><ul>${b.actions.map((a) => `<li>${esc(a)}</li>`).join("")}</ul>` : ""}
      ${timeline}
      <h4>Sources <small>(${b.sources.length})</small></h4>
      <ol class="sources">${b.sources
        .map(
          (s) =>
            `<li>${s.url ? `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title)}</a>` : esc(s.title)}` +
            `${s.publisher ? `, ${esc(s.publisher)}` : ""} <span class="stype">[${esc(s.type)}]</span>` +
            `${s.accessed ? ` <span class="acc">accessed ${esc(s.accessed)}</span>` : ""}</li>`,
        )
        .join("")}</ol>
      ${related ? `<h4>Related</h4><p class="related">${related}</p>` : ""}
    </article>`;
}

export function editionLabel(ed: Edition): string {
  return `${esc(ed.edition.label)}${ed.edition.status ? ` · ${esc(ed.edition.status)}` : ""}`;
}
