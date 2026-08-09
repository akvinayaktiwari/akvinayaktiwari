// Patches a checkout of Platane/snk so the rendered snake grows as it eats.
//
// Why a patch and not an action input: snk's solver runs a fixed-length snake
// (`const snake = snake4` in packages/generate-snake-animation), and nextSnake
// shifts the body array without ever extending it -- length is structural, not
// configurable. Raising it is also not viable: route-search cost explodes with
// length (4 solves in ~5s, 6 took ~161s, 9 did not finish in 2 minutes).
//
// So the solver is left alone at length 4 and growth happens purely in the
// renderer. That is sound because of how the body is stored: nextSnake shifts
// cells down one slot per frame, which makes segment i exactly "where the head
// was i frames ago". Extra segments are just the head's own trail sampled
// further back -- no re-solve, no extra search time.
//
// Usage: node scripts/patch-snake-growth.mjs <path-to-snk-checkout>

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = process.argv[2];
if (!root) {
  console.error("usage: node patch-snake-growth.mjs <path-to-snk-checkout>");
  process.exit(1);
}

const SNAKE_TS = `import { getHeadX, getHeadY, getSnakeLength, snakeToCells } from "@snk/types/snake";
import type { Snake } from "@snk/types/snake";
import type { Point } from "@snk/types/point";
import { h } from "./xml-utils";
import { createAnimation } from "./css-utils";

export type Options = {
  colorSnake: string;
  sizeCell: number;
  sizeDot: number;
};

const lerp = (k: number, a: number, b: number) => (1 - k) * a + k * b;

// Segment count the snake reaches by the last frame. Capped rather than one
// segment per contribution: the grid is only 7 rows tall, so an uncapped snake
// would be longer than the board and would spend the animation drawn over
// itself. Each segment also costs its own @keyframes block in the SVG.
const MAX_SNAKE_LENGTH = 20;

// How much of the head-to-tail size taper to spread the growth over. Upstream
// uses 4, which would leave every grown segment pinned at the minimum dot size
// and read as a thin thread trailing the head.
const SIZE_TAPER_OVER = 8;

type LivingCell = { t: number | null };

export const createSnake = (
  chain: Snake[],
  { sizeCell, sizeDot }: Options,
  duration: number,
  livingCells: LivingCell[] = [],
) => {
  const baseN = chain[0] ? getSnakeLength(chain[0]) : 0;

  // Normalized times at which a cell gets eaten -- the moments to grow on.
  const eatTimes = livingCells
    .map((c) => c.t)
    .filter((t): t is number => t !== null)
    .sort((a, b) => a - b);

  const grownN = Math.max(
    baseN,
    Math.min(MAX_SNAKE_LENGTH, baseN + eatTimes.length),
  );
  const extraN = grownN - baseN;

  // Where the head sits on every frame. Segment i trails it by i frames.
  const headPositions: Point[] = chain.map((snake) => ({
    x: getHeadX(snake),
    y: getHeadY(snake),
  }));

  // Positions of the segments the solver actually knows about.
  const baseParts: Point[][] = Array.from({ length: baseN }, () => []);
  for (const snake of chain) {
    const cells = snakeToCells(snake);
    for (let i = cells.length; i--; ) baseParts[i].push(cells[i]);
  }

  // Grown segments: the head's trail, clamped at the start of the animation
  // (they are still hidden then, so the clamp is never visible).
  const grownParts: Point[][] = Array.from({ length: extraN }, (_, j) => {
    const lag = baseN + j;
    return headPositions.map((_, t) => headPositions[Math.max(0, t - lag)]);
  });

  const parts = [...baseParts, ...grownParts];

  // Segment j appears on the eat event that its share of the growth maps to,
  // so the snake lengthens steadily across the whole animation.
  const revealTimeOf = (j: number) => {
    if (extraN <= 0 || eatTimes.length === 0) return 0;
    const k = Math.ceil(((j + 1) * eatTimes.length) / extraN) - 1;
    return eatTimes[Math.max(0, Math.min(eatTimes.length - 1, k))];
  };

  const sizeOf = (i: number) => {
    const dMin = sizeDot * 0.8;
    const dMax = sizeCell * 0.9;
    const iMax = Math.min(SIZE_TAPER_OVER, parts.length);
    const u = (1 - Math.min(i, iMax) / iMax) ** 2;
    return lerp(u, dMin, dMax);
  };

  const svgElements = parts.map((_, i) => {
    const s = sizeOf(i);
    const m = (sizeCell - s) / 2;
    const r = Math.min(4.5, (4 * s) / sizeDot);

    const rect = h("rect", {
      class: \`s s\${i}\`,
      x: m.toFixed(1),
      y: m.toFixed(1),
      width: s.toFixed(1),
      height: s.toFixed(1),
      rx: r.toFixed(1),
      ry: r.toFixed(1),
    });

    // Grown segments fade in on their eat event. The opacity animation lives
    // on a wrapping <g> so it cannot collide with the transform animation the
    // rect already runs.
    if (i < baseN) return rect;
    return \`<g class="sg sg\${i}">\${rect}</g>\`;
  });

  const transform = ({ x, y }: Point) =>
    \`transform:translate(\${x * sizeCell}px,\${y * sizeCell}px)\`;

  const styles = [
    \`.s{
      shape-rendering: geometricPrecision;
      fill: var(--cs);
      animation: none linear \${duration}ms infinite
    }\`,

    \`.sg{ animation: none linear \${duration}ms infinite }\`,

    ...parts.map((positions, i) => {
      const id = \`s\${i}\`;

      const keyframes = removeInterpolatedPositions(
        positions.map((tr, k, { length }) => ({ ...tr, t: k / length })),
      ).map(({ t, ...p }) => ({ t, style: transform(p) }));

      const rules = [
        createAnimation(id, keyframes),
        \`.s.\${id}{
          \${transform(positions[0])};
          animation-name: \${id}
        }\`,
      ];

      if (i >= baseN) {
        const reveal = revealTimeOf(i - baseN);
        const gid = \`sg\${i}\`;
        rules.push(
          createAnimation(gid, [
            { t: 0, style: "opacity:0" },
            { t: Math.max(0, reveal - 0.004), style: "opacity:0" },
            { t: reveal, style: "opacity:1" },
            { t: 1, style: "opacity:1" },
          ]),
          \`.sg.\${gid}{ opacity:0; animation-name: \${gid} }\`,
        );
      }

      return rules;
    }),
  ].flat();

  return { svgElements, styles };
};

const removeInterpolatedPositions = <T extends Point>(arr: T[]) =>
  arr.filter((u, i, arr) => {
    if (i - 1 < 0 || i + 1 >= arr.length) return true;

    const a = arr[i - 1];
    const b = arr[i + 1];

    const ex = (a.x + b.x) / 2;
    const ey = (a.y + b.y) / 2;

    return !(Math.abs(ex - u.x) < 0.01 && Math.abs(ey - u.y) < 0.01);
  });
`;

/** Fail loudly if upstream moved, rather than silently emitting a stock snake. */
const patch = (relPath, expect, transform) => {
  const file = join(root, relPath);
  const before = readFileSync(file, "utf8");
  if (!before.includes(expect)) {
    throw new Error(
      `Cannot patch ${relPath}: expected to find ${JSON.stringify(expect)}. ` +
        `Upstream snk has changed -- re-check the patch before trusting the output.`,
    );
  }
  writeFileSync(file, transform(before));
  console.log(`patched ${relPath}`);
};

// createLivingCells already stamps each cell with the normalized time it is
// eaten; hand those to the renderer so it knows when to reveal a segment.
patch(
  "packages/svg-creator/index.ts",
  "createSnake(chain, drawOptions, duration)",
  (s) =>
    s.replace(
      "createSnake(chain, drawOptions, duration)",
      "createSnake(chain, drawOptions, duration, livingCells)",
    ),
);

patch("packages/svg-creator/snake.ts", "export const createSnake", () => SNAKE_TS);

console.log("snake growth patch applied");
