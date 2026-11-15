import {
  CircleCollider,
  RectCollider,
  WORLD_COLLIDERS,
} from './pronteraLayout';

export const NAV_MIN = -134;
export const NAV_MAX = 134;
export const NAV_CELL = 2;
export const NAV_COLS = Math.round((NAV_MAX - NAV_MIN) / NAV_CELL); // 134

export interface Point2D {
  x: number;
  z: number;
}

export interface NavigationGridOptions {
  minCoord?: number;
  maxCoord?: number;
  cellSize?: number;
  rects?: RectCollider[];
  circles?: CircleCollider[];
  actorRadius?: number;
  isBlockedFn?: (x: number, z: number) => boolean;
}

export class NavigationGrid {
  readonly cols: number;
  readonly cellSize: number;
  readonly minCoord: number;
  readonly maxCoord: number;
  readonly blocked: Uint8Array;
  private readonly rects: RectCollider[];
  private readonly circles: CircleCollider[];
  private readonly isBlockedFn?: (x: number, z: number) => boolean;

  constructor(
    rectsOrOpts: RectCollider[] | NavigationGridOptions = WORLD_COLLIDERS.rects,
    circlesArg: CircleCollider[] = WORLD_COLLIDERS.circles,
    actorRadiusArg = 0.65,
  ) {
    const opts: NavigationGridOptions = Array.isArray(rectsOrOpts)
      ? { rects: rectsOrOpts, circles: circlesArg, actorRadius: actorRadiusArg }
      : rectsOrOpts;

    this.minCoord = opts.minCoord ?? NAV_MIN;
    this.maxCoord = opts.maxCoord ?? NAV_MAX;
    this.cellSize = opts.cellSize ?? NAV_CELL;
    this.cols = Math.round((this.maxCoord - this.minCoord) / this.cellSize);
    this.rects = opts.rects ?? WORLD_COLLIDERS.rects;
    this.circles = opts.circles ?? WORLD_COLLIDERS.circles;
    const actorRadius = opts.actorRadius ?? 0.65;
    this.isBlockedFn = opts.isBlockedFn;
    this.blocked = new Uint8Array(this.cols * this.cols);

    for (let gz = 0; gz < this.cols; gz++) {
      for (let gx = 0; gx < this.cols; gx++) {
        const wx = this.minCoord + (gx + 0.5) * this.cellSize;
        const wz = this.minCoord + (gz + 0.5) * this.cellSize;
        if (this.pointHitsCollider(wx, wz, actorRadius)) {
          this.blocked[gz * this.cols + gx] = 1;
        }
      }
    }
  }

  pointHitsCollider(x: number, z: number, pad = 0.55): boolean {
    if (
      x < this.minCoord + 1.5 ||
      x > this.maxCoord - 1.5 ||
      z < this.minCoord + 1.5 ||
      z > this.maxCoord - 1.5
    ) {
      return true;
    }
    if (this.isBlockedFn && this.isBlockedFn(x, z)) {
      return true;
    }
    for (let i = 0; i < this.rects.length; i++) {
      const r = this.rects[i];
      if (
        x >= r.minX - pad &&
        x <= r.maxX + pad &&
        z >= r.minZ - pad &&
        z <= r.maxZ + pad
      ) {
        return true;
      }
    }
    for (let i = 0; i < this.circles.length; i++) {
      const c = this.circles[i];
      const dx = x - c.x;
      const dz = z - c.z;
      const rad = c.r + pad;
      if (dx * dx + dz * dz <= rad * rad) {
        return true;
      }
    }
    return false;
  }

  worldToGrid(x: number, z: number): { gx: number; gz: number } {
    const gx = Math.max(
      0,
      Math.min(
        this.cols - 1,
        Math.floor((x - this.minCoord) / this.cellSize),
      ),
    );
    const gz = Math.max(
      0,
      Math.min(
        this.cols - 1,
        Math.floor((z - this.minCoord) / this.cellSize),
      ),
    );
    return { gx, gz };
  }

  gridToWorld(gx: number, gz: number): Point2D {
    return {
      x: this.minCoord + (gx + 0.5) * this.cellSize,
      z: this.minCoord + (gz + 0.5) * this.cellSize,
    };
  }

  isCellWalkable(gx: number, gz: number): boolean {
    if (gx < 0 || gz < 0 || gx >= this.cols || gz >= this.cols) return false;
    return this.blocked[gz * this.cols + gx] === 0;
  }

  findNearestWalkableCell(gx: number, gz: number, maxRadius = 8): { gx: number; gz: number } | null {
    if (this.isCellWalkable(gx, gz)) return { gx, gz };
    for (let r = 1; r <= maxRadius; r++) {
      let best: { gx: number; gz: number; d: number } | null = null;
      for (let dz = -r; dz <= r; dz++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.abs(dx) !== r && Math.abs(dz) !== r) continue;
          const nx = gx + dx;
          const nz = gz + dz;
          if (this.isCellWalkable(nx, nz)) {
            const d = dx * dx + dz * dz;
            if (!best || d < best.d) {
              best = { gx: nx, gz: nz, d };
            }
          }
        }
      }
      if (best) return { gx: best.gx, gz: best.gz };
    }
    return null;
  }

  hasLineOfSight(a: Point2D, b: Point2D): boolean {
    const dist = Math.hypot(b.x - a.x, b.z - a.z);
    const steps = Math.max(2, Math.ceil(dist / 0.55));
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const px = a.x + (b.x - a.x) * t;
      const pz = a.z + (b.z - a.z) * t;
      if (this.pointHitsCollider(px, pz, 0.62)) {
        return false;
      }
    }
    return true;
  }

  /**
   * Ragnarok-style A* pathfinding with diagonal movement and line-of-sight smoothing.
   */
  findPath(startX: number, startZ: number, endX: number, endZ: number): Point2D[] {
    const startCellRaw = this.worldToGrid(startX, startZ);
    const endCellRaw = this.worldToGrid(endX, endZ);

    const startCell = this.findNearestWalkableCell(startCellRaw.gx, startCellRaw.gz, 6);
    const endCell = this.findNearestWalkableCell(endCellRaw.gx, endCellRaw.gz, 8);
    if (!startCell || !endCell) return [];

    // Fast direct walk if completely clear
    const clampedEnd = this.isCellWalkable(endCellRaw.gx, endCellRaw.gz)
      ? { x: endX, z: endZ }
      : this.gridToWorld(endCell.gx, endCell.gz);

    if (
      !this.pointHitsCollider(clampedEnd.x, clampedEnd.z, 0.55) &&
      this.hasLineOfSight({ x: startX, z: startZ }, clampedEnd)
    ) {
      return [clampedEnd];
    }

    const total = this.cols * this.cols;
    const gScore = new Float32Array(total);
    const fScore = new Float32Array(total);
    const cameFrom = new Int32Array(total);
    const state = new Uint8Array(total); // 0=unvisited, 1=open, 2=closed

    gScore.fill(1e9);
    fScore.fill(1e9);
    cameFrom.fill(-1);

    const startIdx = startCell.gz * this.cols + startCell.gx;
    const goalIdx = endCell.gz * this.cols + endCell.gx;

    const octile = (ax: number, az: number, bx: number, bz: number) => {
      const dx = Math.abs(ax - bx);
      const dz = Math.abs(az - bz);
      return Math.max(dx, dz) + (Math.SQRT2 - 1) * Math.min(dx, dz);
    };

    gScore[startIdx] = 0;
    fScore[startIdx] = octile(startCell.gx, startCell.gz, endCell.gx, endCell.gz);
    state[startIdx] = 1;

    // Min-heap open set
    const heap: number[] = [startIdx];
    const pushHeap = (idx: number) => {
      heap.push(idx);
      let i = heap.length - 1;
      while (i > 0) {
        const p = (i - 1) >> 1;
        if (fScore[heap[p]] <= fScore[heap[i]]) break;
        const tmp = heap[p];
        heap[p] = heap[i];
        heap[i] = tmp;
        i = p;
      }
    };
    const popHeap = (): number => {
      const top = heap[0];
      const last = heap.pop()!;
      if (heap.length > 0) {
        heap[0] = last;
        let i = 0;
        const len = heap.length;
        while (true) {
          let smallest = i;
          const l = 2 * i + 1;
          const r = 2 * i + 2;
          if (l < len && fScore[heap[l]] < fScore[heap[smallest]]) smallest = l;
          if (r < len && fScore[heap[r]] < fScore[heap[smallest]]) smallest = r;
          if (smallest === i) break;
          const tmp = heap[i];
          heap[i] = heap[smallest];
          heap[smallest] = tmp;
          i = smallest;
        }
      }
      return top;
    };

    const dirs: [number, number, number][] = [
      [1, 0, 1],
      [-1, 0, 1],
      [0, 1, 1],
      [0, -1, 1],
      [1, 1, Math.SQRT2],
      [-1, 1, Math.SQRT2],
      [1, -1, Math.SQRT2],
      [-1, -1, Math.SQRT2],
    ];

    let found = false;
    while (heap.length > 0) {
      const cur = popHeap();
      if (cur === goalIdx) {
        found = true;
        break;
      }
      if (state[cur] === 2) continue;
      state[cur] = 2;

      const cx = cur % this.cols;
      const cz = Math.floor(cur / this.cols);

      for (let i = 0; i < dirs.length; i++) {
        const [dx, dz, cost] = dirs[i];
        const nx = cx + dx;
        const nz = cz + dz;
        if (!this.isCellWalkable(nx, nz)) continue;

        // Prevent corner-cutting on diagonals
        if (dx !== 0 && dz !== 0) {
          if (!this.isCellWalkable(cx + dx, cz) || !this.isCellWalkable(cx, cz + dz)) {
            continue;
          }
        }

        const nIdx = nz * this.cols + nx;
        if (state[nIdx] === 2) continue;

        const tentativeG = gScore[cur] + cost;
        if (tentativeG < gScore[nIdx]) {
          cameFrom[nIdx] = cur;
          gScore[nIdx] = tentativeG;
          fScore[nIdx] = tentativeG + octile(nx, nz, endCell.gx, endCell.gz);
          state[nIdx] = 1;
          pushHeap(nIdx);
        }
      }
    }

    if (!found) return [];

    // Reconstruct raw grid waypoints
    const raw: Point2D[] = [];
    let trace = goalIdx;
    while (trace !== -1 && trace !== startIdx) {
      const tx = trace % this.cols;
      const tz = Math.floor(trace / this.cols);
      raw.push(this.gridToWorld(tx, tz));
      trace = cameFrom[trace];
    }
    raw.reverse();

    if (raw.length > 0 && !this.pointHitsCollider(clampedEnd.x, clampedEnd.z, 0.55)) {
      raw[raw.length - 1] = clampedEnd;
    }

    // String-pull smoothing for natural RO diagonal walks
    const full = [{ x: startX, z: startZ }, ...raw];
    const smoothed: Point2D[] = [];
    let anchor = 0;
    while (anchor < full.length - 1) {
      let farthest = anchor + 1;
      for (let probe = full.length - 1; probe > anchor + 1; probe--) {
        if (this.hasLineOfSight(full[anchor], full[probe])) {
          farthest = probe;
          break;
        }
      }
      smoothed.push(full[farthest]);
      anchor = farthest;
    }

    return smoothed;
  }

  /**
   * Resolves player collision against all walls, buildings, stalls, and trees with smooth sliding.
   */
  resolveCollision(x: number, z: number, radius = 0.58, prevX?: number, prevZ?: number): Point2D {
    const minB = this.minCoord + 3;
    const maxB = this.maxCoord - 3;
    let px = Math.max(minB, Math.min(maxB, x));
    let pz = Math.max(minB, Math.min(maxB, z));

    for (let pass = 0; pass < 2; pass++) {
      for (let i = 0; i < this.rects.length; i++) {
        const r = this.rects[i];
        const closestX = Math.max(r.minX, Math.min(px, r.maxX));
        const closestZ = Math.max(r.minZ, Math.min(pz, r.maxZ));
        const dx = px - closestX;
        const dz = pz - closestZ;
        const distSq = dx * dx + dz * dz;

        if (distSq < radius * radius) {
          if (distSq > 1e-8) {
            const dist = Math.sqrt(distSq);
            const push = radius - dist;
            px += (dx / dist) * push;
            pz += (dz / dist) * push;
          } else {
            const left = Math.abs(px - r.minX);
            const right = Math.abs(r.maxX - px);
            const top = Math.abs(pz - r.minZ);
            const bottom = Math.abs(r.maxZ - pz);
            const minEdge = Math.min(left, right, top, bottom);
            if (minEdge === left) px = r.minX - radius;
            else if (minEdge === right) px = r.maxX + radius;
            else if (minEdge === top) pz = r.minZ - radius;
            else pz = r.maxZ + radius;
          }
        }
      }

      for (let i = 0; i < this.circles.length; i++) {
        const c = this.circles[i];
        const dx = px - c.x;
        const dz = pz - c.z;
        const minDist = c.r + radius;
        const distSq = dx * dx + dz * dz;
        if (distSq < minDist * minDist) {
          if (distSq > 1e-8) {
            const dist = Math.sqrt(distSq);
            const push = minDist - dist;
            px += (dx / dist) * push;
            pz += (dz / dist) * push;
          } else {
            px += minDist;
          }
        }
      }
    }

    if (this.isBlockedFn && this.isBlockedFn(px, pz) && prevX !== undefined && prevZ !== undefined) {
      // Try sliding along X or Z independently before falling back to previous valid point
      if (!this.isBlockedFn(px, prevZ)) {
        pz = prevZ;
      } else if (!this.isBlockedFn(prevX, pz)) {
        px = prevX;
      } else {
        px = prevX;
        pz = prevZ;
      }
    }

    return { x: px, z: pz };
  }
}

export const PRONTERA_NAV = new NavigationGrid();
