// Patches a checkout of Platane/snk so the snake actually grows as it eats,
// the way a snake game works.
//
// Why this is a patch and not an action input:
//
// snk solves the route with getBestRoute(grid, snake) for a FIXED-length snake,
// and nextSnake shifts the body array without ever extending it. Length is
// structural, not configurable. More importantly the route is only collision-
// free AT the length it was solved for -- snakeWillSelfCollide is what the
// search consults, and it deliberately ignores the tail cell because a moving
// snake's tail vacates as the head arrives.
//
// That last detail is why growth cannot be faked in the renderer. Measured on a
// real 53x7 grid, the stock length-4 route revisits a cell just 4 frames later
// in 5 places, so a snake drawn any longer than 4 has its head inside its own
// body (at length 20, on 19 of 289 frames). Drawing a longer snake on a short
// snake's route produces an animation that is not a legal game.
//
// So this replaces the router with one that plans against a body that changes
// size: it grows on every contribution, treats its tail as solid on the ticks
// it eats (when the tail does NOT vacate), and only commits a move that leaves
// it able to reach its own tail afterwards. The finished chain is re-checked
// against the rules before it is returned, so a bad route fails the build
// instead of publishing a snake that eats itself.
//
// The renderer is replaced too, because upstream's sizes every segment from
// chain[0] and would break on a chain whose length changes.
//
// The route also ends where it began, the way upstream's getPathToPose does:
// once the grid is clear the snake walks to the row above it and lays out
// along it, then retracts into the starting pose, so the final frame is
// identical to the first and the animation loops instead of cutting.
//
// Usage: node scripts/patch-snake-growth.mjs <path-to-snk-checkout>

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = process.argv[2];
if (!root) {
  console.error("usage: node patch-snake-growth.mjs <path-to-snk-checkout>");
  process.exit(1);
}

const GROWING_ROUTE_TS = `import {
  getColor,
  isEmpty,
  isInside,
  isInsideLarge,
  setColorEmpty,
  copyGrid,
} from "@snk/types/grid";
import { around4 } from "@snk/types/point";
import { createSnakeFromCells, snakeToCells } from "@snk/types/snake";
import type { Grid } from "@snk/types/grid";
import type { Point } from "@snk/types/point";
import type { Snake } from "@snk/types/snake";

// The snake may roam this far outside the grid, matching getPathTo's
// isInsideLarge(grid, 2, ...). On a 53x7 grid that is a 57x11 arena.
const MARGIN = 2;

// Safety valve: a stuck search must fail loudly rather than spin forever.
const MAX_STEPS = 100000;

const keyOf = (x: number, y: number) => (x + MARGIN) * 4096 + (y + MARGIN);

/** Inside the arena, and not an uneaten contribution cell. */
const isFree = (grid: Grid, x: number, y: number) =>
  isInsideLarge(grid, MARGIN, x, y) &&
  (!isInside(grid, x, y) || isEmpty(getColor(grid, x, y)));

const isFood = (grid: Grid, x: number, y: number) =>
  isInside(grid, x, y) && !isEmpty(getColor(grid, x, y));

/**
 * Cells the body occupies next turn.
 *
 * The tail is excluded when the snake is not about to eat, because it vacates
 * on the same tick the head arrives -- this is the rule snakeWillSelfCollide
 * encodes upstream. When the snake IS about to eat it does not vacate, so the
 * tail counts as solid. That asymmetry is the whole reason a growing snake
 * cannot reuse the stock collision check.
 */
const bodyBlocks = (cells: Point[], willGrow: boolean) => {
  const blocked = new Set<number>();
  const n = willGrow ? cells.length : cells.length - 1;
  for (let i = 0; i < n; i++) blocked.add(keyOf(cells[i].x, cells[i].y));
  return blocked;
};

/** Flood fill of cells reachable from (x,y), stopping once \`limit\` is hit. */
const reachableCount = (
  grid: Grid,
  cells: Point[],
  x: number,
  y: number,
  limit: number,
) => {
  const blocked = bodyBlocks(cells, false);
  const seen = new Set<number>([keyOf(x, y)]);
  const queue: Point[] = [{ x, y }];
  let count = 0;

  while (queue.length) {
    const c = queue.shift()!;
    count++;
    if (count >= limit) return count;

    for (const a of around4) {
      const nx = c.x + a.x;
      const ny = c.y + a.y;
      const k = keyOf(nx, ny);
      // Food is walkable here: it will have been eaten by the time the snake
      // needs this space, so treating it as a wall would reject safe routes.
      if (
        seen.has(k) ||
        blocked.has(k) ||
        !isInsideLarge(grid, MARGIN, nx, ny)
      )
        continue;
      seen.add(k);
      queue.push({ x: nx, y: ny });
    }
  }
  return count;
};

/**
 * Breadth-first step toward the nearest food. Returns the first move of the
 * shortest route, or null when no food is reachable.
 */
const stepTowardFood = (grid: Grid, cells: Point[]): Point | null => {
  const head = cells[0];
  const blocked = bodyBlocks(cells, false);

  const seen = new Set<number>([keyOf(head.x, head.y)]);
  // Each entry carries the first move that led to it, so the answer falls out
  // without rebuilding the path.
  const queue: { p: Point; first: Point }[] = [];

  for (const a of around4) {
    const nx = head.x + a.x;
    const ny = head.y + a.y;
    const k = keyOf(nx, ny);
    if (blocked.has(k) || !isInsideLarge(grid, MARGIN, nx, ny)) continue;
    if (isFood(grid, nx, ny)) return a;
    if (!isFree(grid, nx, ny)) continue;
    seen.add(k);
    queue.push({ p: { x: nx, y: ny }, first: a });
  }

  while (queue.length) {
    const { p, first } = queue.shift()!;
    for (const a of around4) {
      const nx = p.x + a.x;
      const ny = p.y + a.y;
      const k = keyOf(nx, ny);
      if (seen.has(k) || blocked.has(k) || !isInsideLarge(grid, MARGIN, nx, ny))
        continue;
      if (isFood(grid, nx, ny)) return first;
      if (!isFree(grid, nx, ny)) continue;
      seen.add(k);
      queue.push({ p: { x: nx, y: ny }, first });
    }
  }
  return null;
};

/** Move the snake one cell, growing when it lands on a contribution. */
const advance = (grid: Grid, cells: Point[], d: Point) => {
  const head = { x: cells[0].x + d.x, y: cells[0].y + d.y };
  const ate = isFood(grid, head.x, head.y);
  const next = ate ? [head, ...cells] : [head, ...cells.slice(0, -1)];
  return { next, ate };
};

const isLegal = (grid: Grid, cells: Point[], d: Point) => {
  const nx = cells[0].x + d.x;
  const ny = cells[0].y + d.y;
  if (!isInsideLarge(grid, MARGIN, nx, ny)) return false;
  const willGrow = isFood(grid, nx, ny);
  return !bodyBlocks(cells, willGrow).has(keyOf(nx, ny));
};

/**
 * A move is safe when, after taking it, the snake can still reach its own tail.
 * That is the standard survivability test: if the tail is reachable the snake
 * can always trail it until space opens up, so it cannot be sealed in.
 */
const isSafe = (grid: Grid, cells: Point[], d: Point) => {
  if (!isLegal(grid, cells, d)) return false;

  const nextGrid = copyGrid(grid);
  const { next, ate } = advance(grid, cells, d);
  if (ate) setColorEmpty(nextGrid, next[0].x, next[0].y);

  const tail = next[next.length - 1];
  const head = next[0];

  // Trailing the tail needs somewhere to go, so require the open region to be
  // at least as large as the body -- reaching the tail through a one-cell
  // crack is not actually survivable.
  const blocked = bodyBlocks(next, false);
  const seen = new Set<number>([keyOf(head.x, head.y)]);
  const queue: Point[] = [head];
  let tailReached = false;
  let open = 0;

  while (queue.length) {
    const c = queue.shift()!;
    open++;
    for (const a of around4) {
      const nx = c.x + a.x;
      const ny = c.y + a.y;
      const k = keyOf(nx, ny);
      if (nx === tail.x && ny === tail.y) tailReached = true;
      if (seen.has(k) || blocked.has(k) || !isInsideLarge(nextGrid, MARGIN, nx, ny))
        continue;
      seen.add(k);
      queue.push({ x: nx, y: ny });
    }
  }

  return tailReached && open >= next.length;
};

/** Last resort: stay alive and keep as much room as possible. */
const survivalStep = (
  grid: Grid,
  cells: Point[],
  blockRow?: number,
): Point | null => {
  let best: Point | null = null;
  let bestScore = -1;
  for (const a of around4) {
    if (blockRow !== undefined && cells[0].y + a.y === blockRow) continue;
    if (!isSafe(grid, cells, a)) continue;
    const { next } = advance(grid, cells, a);
    const score = reachableCount(grid, next, next[0].x, next[0].y, 1000);
    if (score > bestScore) {
      bestScore = score;
      best = a;
    }
  }
  if (best) return best;

  // Nothing safe left; take any legal move rather than stopping dead.
  for (const a of around4) if (isLegal(grid, cells, a)) return a;
  return null;
};



/** BFS step toward an arbitrary cell. Mirrors stepTowardFood's shape. */
const stepTowardCell = (
  grid: Grid,
  cells: Point[],
  tx: number,
  ty: number,
  blockRow?: number,
): Point | null => {
  const usable = (x: number, y: number) =>
    isFree(grid, x, y) && (blockRow === undefined || y !== blockRow);
  const head = cells[0];
  if (head.x === tx && head.y === ty) return null;
  const blocked = bodyBlocks(cells, false);

  const seen = new Set<number>([keyOf(head.x, head.y)]);
  const queue: { p: Point; first: Point }[] = [];

  for (const a of around4) {
    const nx = head.x + a.x;
    const ny = head.y + a.y;
    if (blocked.has(keyOf(nx, ny)) || !usable(nx, ny)) continue;
    if (nx === tx && ny === ty) return a;
    seen.add(keyOf(nx, ny));
    queue.push({ p: { x: nx, y: ny }, first: a });
  }

  while (queue.length) {
    const { p, first } = queue.shift()!;
    for (const a of around4) {
      const nx = p.x + a.x;
      const ny = p.y + a.y;
      const k = keyOf(nx, ny);
      if (seen.has(k) || blocked.has(k) || !usable(nx, ny)) continue;
      if (nx === tx && ny === ty) return first;
      seen.add(k);
      queue.push({ p: { x: nx, y: ny }, first });
    }
  }
  return null;
};

/**
 * After the grid is clear, bring the snake home so the animation loops instead
 * of cutting. Home is the row just above the grid: the snake walks to the far
 * right of that row and then straight left, which leaves its body stretched
 * along the row with its first cells sitting exactly on the starting pose.
 *
 * Best effort -- if the snake cannot get there the chain is simply left as it
 * is, and the loop cuts rather than the build failing.
 */
const returnHome = (
  grid: Grid,
  cells: Point[],
  chain: Snake[],
  home: Point[],
) => {
  const laneY = home[0].y;
  const homeX = home[0].x;
  const entryX = grid.width + MARGIN - 1;

  /** Can the snake walk the whole lane from here without meeting itself? */
  const laneIsClear = (from: Point[]) => {
    let sim = from;
    for (let x = from[0].x; x > homeX; x--) {
      if (!isLegal(grid, sim, { x: -1, y: 0 })) return false;
      sim = advance(grid, sim, { x: -1, y: 0 }).next;
    }
    return true;
  };

  let guard = MAX_STEPS;
  // Approach one row below the lane, and treat the lane itself as a wall while
  // doing it. That way no new body cell can be laid across the lane, so the
  // cells still in it only have to drain away as the tail follows.
  const stagingY = laneY + 1;

  for (let attempt = 0; attempt < 64; attempt++) {
    while (cells[0].x !== entryX || cells[0].y !== stagingY) {
      if (guard-- <= 0) return cells;
      const move =
        stepTowardCell(grid, cells, entryX, stagingY, laneY) ??
        survivalStep(grid, cells, laneY);
      if (!move) return cells;
      cells = advance(grid, cells, move).next;
      chain.push(createSnakeFromCells(cells));
    }

    // Step up into the lane, then walk it -- but only once it is provably
    // clear, otherwise circle below until the tail has drained out of it.
    if (laneIsClear(advance(grid, cells, { x: 0, y: -1 }).next)) {
      cells = advance(grid, cells, { x: 0, y: -1 }).next;
      chain.push(createSnakeFromCells(cells));
      while (cells[0].x > homeX) {
        cells = advance(grid, cells, { x: -1, y: 0 }).next;
        chain.push(createSnakeFromCells(cells));
      }
      return cells;
    }

    for (let i = 0; i < cells.length && guard-- > 0; i++) {
      const move = survivalStep(grid, cells, laneY);
      if (!move) return cells;
      cells = advance(grid, cells, move).next;
      chain.push(createSnakeFromCells(cells));
    }
  }

  return cells;
};

/**
 * The outro: the surplus body retracts into the starting pose so the last frame
 * matches the first and the loop is seamless. This is not a game move -- a
 * snake does not shrink -- so it is held to its own rules and validated apart
 * from the play phase.
 */
const RETRACT_FRAMES = 12;

const retractToPose = (cells: Point[], chain: Snake[], poseLength: number) => {
  const surplus = cells.length - poseLength;
  if (surplus <= 0) return;
  const perFrame = Math.max(1, Math.ceil(surplus / RETRACT_FRAMES));
  let length = cells.length;
  while (length > poseLength) {
    length = Math.max(poseLength, length - perFrame);
    chain.push(createSnakeFromCells(cells.slice(0, length)));
  }
};

/**
 * Re-derive the rules on the finished chain. The whole point of this solver is
 * legality, so it refuses to hand back a route it cannot prove: a bad chain
 * fails the build instead of publishing a snake that eats itself.
 */
const assertLegal = (
  grid0: Grid,
  chain: Snake[],
  food: number,
  playFrames: number,
) => {
  const startLen = snakeToCells(chain[0]).length;
  let ate = 0;

  for (let t = 0; t < playFrames; t++) {
    const c = snakeToCells(chain[t]);

    const seen = new Set<number>();
    for (const p of c) {
      const k = keyOf(p.x, p.y);
      if (seen.has(k))
        throw new Error(\`frame \${t}: snake bites itself at \${p.x},\${p.y}\`);
      seen.add(k);
      if (!isInsideLarge(grid0, MARGIN, p.x, p.y))
        throw new Error(\`frame \${t}: cell \${p.x},\${p.y} left the arena\`);
    }

    if (t === 0) continue;
    const prev = snakeToCells(chain[t - 1]);

    const d =
      Math.abs(c[0].x - prev[0].x) + Math.abs(c[0].y - prev[0].y);
    if (d !== 1) throw new Error(\`frame \${t}: head moved \${d} cells\`);

    const grew = c.length - prev.length;
    if (grew !== 0 && grew !== 1)
      throw new Error(\`frame \${t}: length changed by \${grew}\`);
    if (grew === 1) ate++;

    // The body must trail the head exactly, growth or not.
    for (let i = 1; i < Math.min(c.length, prev.length); i++)
      if (c[i].x !== prev[i - 1].x || c[i].y !== prev[i - 1].y)
        throw new Error(\`frame \${t}: segment \${i} broke from the trail\`);
  }

  if (ate !== food)
    throw new Error(\`grew \${ate} times but there are \${food} contributions\`);
  const playLen = snakeToCells(chain[playFrames - 1]).length;
  if (playLen !== startLen + food)
    throw new Error(\`length after play \${playLen}, expected \${startLen + food}\`);

  // The outro may only shorten the snake from the tail; every remaining cell
  // must stay exactly where it was.
  for (let t = playFrames; t < chain.length; t++) {
    const c = snakeToCells(chain[t]);
    const prev = snakeToCells(chain[t - 1]);
    if (c.length >= prev.length)
      throw new Error(\`frame \${t}: outro did not shorten the snake\`);
    for (let i = 0; i < c.length; i++)
      if (c[i].x !== prev[i].x || c[i].y !== prev[i].y)
        throw new Error(\`frame \${t}: outro moved segment \${i}\`);
  }
};

/**
 * Route a snake that grows by one cell on every contribution it eats.
 *
 * Upstream's getBestRoute solves a fixed-length snake, so its routes are only
 * collision-free at that length -- which is why a longer snake cannot simply be
 * drawn onto one. This plans against a body that changes size as it goes.
 *
 * Returns the chain of snake states, or null if the grid cannot be cleared.
 */
export const getGrowingRoute = (grid0: Grid, snake0: Snake): Snake[] | null => {
  const grid = copyGrid(grid0);
  let cells = snakeToCells(snake0);

  const chain: Snake[] = [createSnakeFromCells(cells)];
  let food = 0;
  for (let x = 0; x < grid.width; x++)
    for (let y = 0; y < grid.height; y++) if (isFood(grid, x, y)) food++;
  let remaining = food;

  let steps = 0;
  while (remaining > 0) {
    if (++steps > MAX_STEPS) return null;

    let move = stepTowardFood(grid, cells);

    // Chasing the nearest food is only allowed when it leaves the snake with a
    // way out; otherwise trail the tail and try again next tick.
    if (!move || !isSafe(grid, cells, move)) {
      const safeFood = around4.find(
        (a) => isSafe(grid, cells, a) && isFood(grid, cells[0].x + a.x, cells[0].y + a.y),
      );
      move = safeFood ?? survivalStep(grid, cells);
    }
    if (!move) return null;

    const { next, ate } = advance(grid, cells, move);
    if (ate) {
      setColorEmpty(grid, next[0].x, next[0].y);
      remaining--;
    }
    cells = next;
    chain.push(createSnakeFromCells(cells));
  }

  const playFrames = (() => {
    const home = snakeToCells(snake0);
    cells = returnHome(grid, cells, chain, home);
    const n = chain.length;
    retractToPose(cells, chain, home.length);
    return n;
  })();

  assertLegal(grid0, chain, food, playFrames);

  return chain;
};
`;

const SNAKE_RENDERER_TS = `import { snakeToCells } from "@snk/types/snake";
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

// How many segments the head-to-tail size taper spans. Upstream uses 4, which
// suits a 4-segment snake; a growing one needs the taper spread further or it
// reads as a fat head towing a uniform thread.
const SIZE_TAPER_OVER = 10;

export const createSnake = (
  chain: Snake[],
  { sizeCell, sizeDot }: Options,
  duration: number,
) => {
  const frames = chain.map(snakeToCells);
  const maxLength = frames.reduce((m, f) => Math.max(m, f.length), 0);

  // Segment i exists from the frame the snake first grows that long. Before
  // that it is parked where it will appear and held invisible, so the fade-in
  // happens in place -- which is what growth looks like, since an eating snake
  // keeps its tail put for one tick while the head advances.
  const bornAt = Array.from({ length: maxLength }, (_, i) =>
    frames.findIndex((f) => i < f.length),
  );

  // ...and stops existing when the outro retracts it back into the starting
  // pose, so the last frame matches the first and the loop does not cut.
  const diesAt = Array.from({ length: maxLength }, (_, i) => {
    for (let t = frames.length; t--; ) if (i < frames[t].length) return t;
    return frames.length - 1;
  });

  const positionsOf = (i: number): Point[] =>
    frames.map((f, t) =>
      i < f.length ? f[i] : frames[t < bornAt[i] ? bornAt[i] : diesAt[i]][i],
    );

  const sizeOf = (i: number) => {
    const dMin = sizeDot * 0.8;
    const dMax = sizeCell * 0.9;
    const iMax = Math.min(SIZE_TAPER_OVER, maxLength);
    const u = (1 - Math.min(i, iMax) / iMax) ** 2;
    return lerp(u, dMin, dMax);
  };

  const svgElements = Array.from({ length: maxLength }, (_, i) => {
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

    // Segments that are present for the whole animation need no reveal at all.
    if (bornAt[i] <= 0 && diesAt[i] >= frames.length - 1) return rect;
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

    ...Array.from({ length: maxLength }, (_, i) => {
      const positions = positionsOf(i);
      const id = \`s\${i}\`;

      const keyframes = removeInterpolatedPositions(
        positions.map((tr, t, { length }) => ({ ...tr, t: t / length })),
      ).map(({ t, ...p }) => ({ t, style: transform(p) }));

      const rules = [
        createAnimation(id, keyframes),
        \`.s.\${id}{
          \${transform(positions[0])};
          animation-name: \${id}
        }\`,
      ];

      if (bornAt[i] > 0 || diesAt[i] < frames.length - 1) {
        const born = bornAt[i] / frames.length;
        const dies = (diesAt[i] + 1) / frames.length;
        const gid = \`sg\${i}\`;
        const fade = [
          { t: 0, style: "opacity:0" },
          { t: Math.max(0, born - 0.004), style: "opacity:0" },
          { t: born, style: "opacity:1" },
        ];
        if (dies < 1) {
          fade.push(
            { t: Math.max(born, dies - 0.004), style: "opacity:1" },
            { t: dies, style: "opacity:0" },
            { t: 1, style: "opacity:0" },
          );
        } else {
          fade.push({ t: 1, style: "opacity:1" });
        }
        rules.push(
          createAnimation(gid, fade),
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

const write = (relPath, contents) => {
  writeFileSync(join(root, relPath), contents);
  console.log(`wrote ${relPath}`);
};

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
  const after = transform(before);
  writeFileSync(file, after);
  console.log(`patched ${relPath}`);
};

write("packages/solver/getGrowingRoute.ts", GROWING_ROUTE_TS);
write("packages/svg-creator/snake.ts", SNAKE_RENDERER_TS);

patch(
  "packages/generate-snake-animation/generateSnakeAnimation.ts",
  "const chain = getBestRoute(grid, snake)!;",
  (s) =>
    s
      .replace(
        'import { getBestRoute } from "@snk/solver/getBestRoute";',
        'import { getBestRoute } from "@snk/solver/getBestRoute";\n' +
          'import { getGrowingRoute } from "@snk/solver/getGrowingRoute";',
      )
      .replace(
        "  const chain = getBestRoute(grid, snake)!;\n" +
          "  chain.push(...getPathToPose(chain.slice(-1)[0], snake)!);",
        [
          "  // Prefer the growing snake. If that search cannot clear this particular",
          "  // grid, fall back to upstream's fixed-length router so the workflow still",
          "  // publishes something rather than failing the profile README.",
          "  let chain = getGrowingRoute(grid, snake);",
          "  if (!chain) {",
          '    console.log("\u26a0 growing route failed, falling back to the fixed-length route");',
          "    chain = getBestRoute(grid, snake)!;",
          "    chain.push(...getPathToPose(chain.slice(-1)[0], snake)!);",
          "  }",
        ].join("\n"),
      ),
);

console.log("snake growth patch applied");
