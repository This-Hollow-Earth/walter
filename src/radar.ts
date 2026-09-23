// Radar renderer for the Environmental Supply Chain Radar.
//
// Adapted from Zalando's tech-radar (radar.js v0.12), MIT License,
// Copyright (c) 2017-2024 Zalando SE — https://github.com/zalando/tech-radar
// Changes: ES/TypeScript module, rough.js wireframe drawing, monochrome,
// externally supplied numbering, click-to-select, legend/title moved to HTML.

import * as d3 from "d3";
import rough from "roughjs";

export type Quadrant = 0 | 1 | 2 | 3; // 0 bottom-right, 1 bottom-left, 2 top-left, 3 top-right
export type Ring = 0 | 1 | 2 | 3; // 0 = innermost (ADOPT)
export type Moved = -1 | 0 | 1 | 2; // -1 out, 0 none, 1 in, 2 new

export interface RadarEntry {
  key: string;
  num: number;
  label: string;
  quadrant: Quadrant;
  ring: Ring;
  moved: Moved;
  active: boolean;
}

export interface RadarConfig {
  svg: SVGSVGElement;
  quadrants: { name: string }[]; // indexed by Quadrant
  rings: { name: string }[]; // indexed by Ring
  entries: RadarEntry[];
  ink: string;
  paper: string;
  selected?: string | null;
  onSelect?: (key: string) => void;
  animate?: boolean; // false = run the force layout synchronously (print)
}

interface Point {
  x: number;
  y: number;
}
interface Polar {
  t: number;
  r: number;
}
interface Segment {
  clipx(d: Point): number;
  clipy(d: Point): number;
  random(): Point;
}
type Node = RadarEntry & d3.SimulationNodeDatum & { segment: Segment; x: number; y: number };

const QUADRANTS = [
  { radial_min: 0, radial_max: 0.5, factor_x: 1, factor_y: 1 },
  { radial_min: 0.5, radial_max: 1, factor_x: -1, factor_y: 1 },
  { radial_min: -1, radial_max: -0.5, factor_x: -1, factor_y: -1 },
  { radial_min: -0.5, radial_max: 0, factor_x: 1, factor_y: -1 },
];
const RINGS = [{ radius: 130 }, { radius: 220 }, { radius: 310 }, { radius: 400 }];

export function renderRadar(config: RadarConfig): void {
  const { ink, paper } = config;

  // reproducible pseudo-random sequence: same data -> same layout
  let seed = 42;
  const random = () => {
    const x = Math.sin(seed++) * 10000;
    return x - Math.floor(x);
  };
  const random_between = (min: number, max: number) => min + random() * (max - min);
  const normal_between = (min: number, max: number) => min + (random() + random()) * 0.5 * (max - min);

  const polar = (c: Point): Polar => ({ t: Math.atan2(c.y, c.x), r: Math.sqrt(c.x * c.x + c.y * c.y) });
  const cartesian = (p: Polar): Point => ({ x: p.r * Math.cos(p.t), y: p.r * Math.sin(p.t) });
  const bounded_interval = (v: number, min: number, max: number) =>
    Math.min(Math.max(v, Math.min(min, max)), Math.max(min, max));
  const bounded_ring = (p: Polar, rmin: number, rmax: number): Polar => ({ t: p.t, r: bounded_interval(p.r, rmin, rmax) });
  const bounded_box = (p: Point, min: Point, max: Point): Point => ({
    x: bounded_interval(p.x, min.x, max.x),
    y: bounded_interval(p.y, min.y, max.y),
  });

  function segment(quadrant: Quadrant, ring: Ring): Segment {
    const q = QUADRANTS[quadrant];
    const polar_min = { t: q.radial_min * Math.PI, r: ring === 0 ? 30 : RINGS[ring - 1].radius };
    const polar_max = { t: q.radial_max * Math.PI, r: RINGS[ring].radius };
    const cmin = { x: 15 * q.factor_x, y: 15 * q.factor_y };
    const cmax = { x: RINGS[3].radius * q.factor_x, y: RINGS[3].radius * q.factor_y };
    const clip = (d: Point) => cartesian(bounded_ring(polar(bounded_box(d, cmin, cmax)), polar_min.r + 15, polar_max.r - 15));
    return {
      clipx(d) {
        d.x = clip(d).x;
        return d.x;
      },
      clipy(d) {
        d.y = clip(d).y;
        return d.y;
      },
      random() {
        return cartesian({ t: random_between(polar_min.t, polar_max.t), r: normal_between(polar_min.r, polar_max.r) });
      },
    };
  }

  const nodes: Node[] = config.entries.map((e) => {
    const seg = segment(e.quadrant, e.ring);
    const p = seg.random();
    return { ...e, segment: seg, x: p.x, y: p.y };
  });

  const svg = d3.select(config.svg);
  svg.selectAll("*").remove();
  svg.attr("viewBox", "-440 -440 880 880").attr("preserveAspectRatio", "xMidYMid meet").style("background-color", paper);

  const rc = rough.svg(config.svg);
  const line = { stroke: ink, strokeWidth: 1, roughness: 0.9, bowing: 0.6 };
  const radar = svg.append("g");
  const grid = radar.append("g").attr("class", "grid");
  const gridNode = grid.node()!;

  // axes
  gridNode.appendChild(rc.line(0, -400, 0, 400, { ...line, seed: 1 }));
  gridNode.appendChild(rc.line(-400, 0, 400, 0, { ...line, seed: 2 }));
  // rings (labels just inside each ring's outer edge, on the vertical axis, with a paper halo)
  RINGS.forEach((ring, i) => {
    gridNode.appendChild(rc.circle(0, 0, ring.radius * 2, { ...line, seed: 10 + i }));
    grid
      .append("text")
      .text(config.rings[i].name)
      .attr("y", -ring.radius + 16)
      .attr("text-anchor", "middle")
      .attr("class", "ring-label")
      .style("fill", ink)
      .style("stroke", paper)
      .style("stroke-width", 5)
      .style("paint-order", "stroke");
  });
  // quadrant labels in the corners
  const qpos: Record<Quadrant, { x: number; y: number; anchor: string }> = {
    0: { x: 425, y: 428, anchor: "end" },
    1: { x: -425, y: 428, anchor: "start" },
    2: { x: -425, y: -414, anchor: "start" },
    3: { x: 425, y: -414, anchor: "end" },
  };
  ([0, 1, 2, 3] as Quadrant[]).forEach((q) => {
    grid
      .append("text")
      .text(config.quadrants[q].name)
      .attr("x", qpos[q].x)
      .attr("y", qpos[q].y)
      .attr("text-anchor", qpos[q].anchor)
      .attr("class", "quadrant-label")
      .style("fill", ink);
  });

  // blips
  const rink = radar.append("g").attr("class", "rink");
  const blips = rink
    .selectAll<SVGGElement, Node>("g.blip")
    .data(nodes)
    .enter()
    .append("g")
    .attr("class", (d) => "blip" + (d.active ? "" : " inactive") + (d.key === config.selected ? " selected" : ""))
    .attr("data-key", (d) => d.key)
    .attr("tabindex", (d) => (d.active ? 0 : -1))
    .attr("role", "button")
    .attr("aria-label", (d) => `${d.num}. ${d.label}`)
    .on("click", (_ev, d) => config.onSelect?.(d.key))
    .on("keydown", (ev: KeyboardEvent, d) => {
      if (ev.key === "Enter" || ev.key === " ") {
        ev.preventDefault();
        config.onSelect?.(d.key);
      }
    });

  blips.each(function (d, i) {
    const g = this as SVGGElement;
    d3.select(g).append("title").text(`${d.num}. ${d.label}`);
    const shape = { stroke: ink, strokeWidth: 1.3, roughness: 0.7, fill: paper, fillStyle: "solid", seed: 100 + i };
    if (d.key === config.selected) {
      g.appendChild(rc.circle(0, 0, 38, { stroke: ink, strokeWidth: 2.2, roughness: 1.4, seed: 900 + i }));
    }
    if (d.moved === 1) {
      g.appendChild(rc.polygon([[-11, 6], [11, 6], [0, -13]], shape));
    } else if (d.moved === -1) {
      g.appendChild(rc.polygon([[-11, -6], [11, -6], [0, 13]], shape));
    } else if (d.moved === 2) {
      g.appendChild(rc.polygon(starPoints(17, 9), shape));
    } else {
      g.appendChild(rc.circle(0, 0, 20, shape));
    }
    d3.select(g)
      .append("text")
      .text(String(d.num))
      .attr("y", 3.5)
      .attr("text-anchor", "middle")
      .attr("class", "blip-num")
      .style("fill", ink);
  });

  const ticked = () => blips.attr("transform", (d) => `translate(${d.segment.clipx(d)},${d.segment.clipy(d)})`);

  const sim = d3
    .forceSimulation<Node>(nodes)
    .velocityDecay(0.19)
    .force("collision", d3.forceCollide<Node>().radius(17).strength(0.85))
    .on("tick", ticked);
  if (config.animate === false) {
    sim.stop();
    for (let i = 0; i < 300; i++) sim.tick();
    ticked();
  }
}

function starPoints(outer: number, inner: number): [number, number][] {
  const pts: [number, number][] = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    pts.push([r * Math.cos(a), r * Math.sin(a)]);
  }
  return pts;
}
