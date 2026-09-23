import "./style.css";
import { QUADRANTS, RINGS } from "./types";
import { INK, PAPER, loadEdition, loadManifest, defaultEditionId, numbered, quadrantNamesByIndex, ringNames, toEntries } from "./data";
import { renderRadar } from "./radar";
import { detailHTML, editionLabel, legendHTML } from "./views";

async function main() {
  const manifest = await loadManifest();
  const ed = await loadEdition(defaultEditionId(manifest));
  const blips = ed.blips;
  const nums = numbered(blips);
  const byId = new Map(blips.map((b) => [b.id, b]));

  document.querySelectorAll(".edition").forEach((el) => (el.innerHTML = editionLabel(ed)));

  renderRadar({
    svg: document.querySelector<SVGSVGElement>("#radar")!,
    quadrants: quadrantNamesByIndex(),
    rings: ringNames(),
    entries: toEntries(blips, nums, () => true),
    ink: INK,
    paper: PAPER,
    animate: false,
  });
  document.querySelector("#legend")!.innerHTML = legendHTML(blips, nums, () => true, byId, null, null, []);

  const sorted = [...blips].sort((a, b) => nums.get(a.id)! - nums.get(b.id)!);
  document.querySelector("#blips")!.innerHTML = QUADRANTS.map((q) => {
    const inQ = sorted.filter((b) => b.quadrant === q.id);
    if (!inQ.length) return "";
    return `<section class="print-quadrant"><h2 class="q-title">${q.name} <small>${q.subtitle}</small></h2>${inQ
      .map((b) => detailHTML(b, nums.get(b.id), byId, nums))
      .join("")}</section>`;
  }).join("");

  // action guide, generated from each blip's `actions`
  document.querySelector("#actions")!.innerHTML = RINGS.map((r) => {
    const inR = sorted.filter((b) => b.ring === r.id && b.actions.length);
    if (!inR.length) return "";
    return `<h3>${r.name}</h3><ul>${inR
      .map((b) => `<li><span class="num">${nums.get(b.id)}</span> <strong>${b.name}</strong>: ${b.actions.join(" ")}</li>`)
      .join("")}</ul>`;
  }).join("");

  document.body.dataset.ready = "true"; // signal for headless-Chrome PDF export
}

main().catch((err) => {
  console.error(err);
  document.querySelector("#app-error")!.textContent = String(err);
});
