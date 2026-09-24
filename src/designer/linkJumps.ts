/**
 * Copyright (c) 2022 大漠穷秋.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

/**
 * **连线交叉处的"跳线桥"**（线路跨越，drafting 里叫 line jump / hop）。
 *
 * ## 解决什么
 *
 * 正交布线的两张工艺图（色选 / 整瓶）都是"一列主干 + 若干条横穿支线"，
 * 支线横穿主干是常态。两条线**直接十字相交**时，读者分不清那是"交叉"还是"汇合"
 * —— 工艺图里汇合意味着流向改变，交叉什么都不意味着，混淆的代价是读错流程。
 *
 * 通行做法（也是送来的参考图里那条画法）：**横向线在交叉点拱起一个半圆，竖向线照直走**。
 * 拱起的那条是"从上面越过"，直走的那条是"从下面穿过"，一眼可分。
 *
 * ## 为什么不需要在下线留缺口
 *
 * 拱起 + 下面那条照直走，视觉上已经足够（参考图里下线也是通的）。
 * 真要"下线断开"就得改 `ICEPolyLine.createPathObject()`（一条折线只有一个路径，
 * 缺口要靠 `moveTo` 拆段）—— 那要动引擎，代价与收益不成比例。
 *
 * ## 为什么在应用层做而不是让引擎做
 *
 * 交叉是**管线之间**的关系，而引擎画每一条线时看不到别的线。
 * 这里做成一对纯函数：`computeLinkJumps()` 吃全图折线、吐"哪条线在哪几点拱起"，
 * `applyLinkJumps()` 把拱起塞进某一条线的点串里 —— 前者可单测，后者无副作用。
 * 管线类只在 `__calcDots()` 之后**重新套用一次**（引擎每次重算几何都会覆盖 points），
 * 这就是它必须挂在类上、而不能只在建图后跑一遍的原因。
 *
 * ## 判据
 *
 * - 只处理**轴对齐**线段（正交布线的产物都是轴对齐的；斜线一律跳过，避免误差判错）；
 * - 交叉点必须**同时落在两条线段内部**（离端点的余量 ≥ `JUMP_ENDPOINT_INSET`）
 *   —— 紧挨拐角的交叉不值得拱，拱起来反而像线画歪了；
 * - 横向线拱起、竖向线不动。两者必有一条是横向的（同向的两条轴对齐线段不可能十字相交），
 *   所以每个交叉**恰好**产生一个拱，不会两条线都拱。
 */
/** 与引擎 `ICEPolyLine` 同口径的取整（它那边的 `round` 没有从包入口导出）。 */
function round(value: number, precision = 0): number {
  const f = Math.pow(10, precision);
  return Math.round(value * f) / f;
}

/** 拱起半径（世界像素）。太小看不出来，太大像断线。 */
export const JUMP_RADIUS = 6;

/** 交叉点离线段端点的最小余量 —— 比拱半径略大，保证拱的两肩在线段内。 */
export const JUMP_ENDPOINT_INSET = JUMP_RADIUS + 3;

/** 拱用几段折线近似（8 段时弦高误差 ≈ 0.11px，肉眼与圆弧无异）。 */
export const JUMP_SEGMENTS = 8;

/** 判定"轴对齐"的容差：正交布线的坐标是四舍五入到 2 位的浮点数。 */
const AXIS_EPS = 0.75;

export interface LinkJumps {
  /** pipeId → 该线要拱起的交叉点（世界坐标） */
  hops: Map<string, number[][]>;
}

/** 一条折线的相邻段：`[p0, p1]`。 */
type Segment = [number[], number[]];

type Axis = 'h' | 'v' | null;

/** 线段是横的、竖的，还是斜的（斜的返回 null —— 一律不判交叉）。 */
function axisOf(seg: Segment): Axis {
  const [a, b] = seg;
  if (Math.abs(a[1] - b[1]) <= AXIS_EPS) return 'h';
  if (Math.abs(a[0] - b[0]) <= AXIS_EPS) return 'v';
  return null;
}

function segmentsOf(points: number[][]): Segment[] {
  const out: Segment[] = [];
  for (let i = 1; i < (points || []).length; i++) {
    const a = points[i - 1];
    const b = points[i];
    if (!a || !b) continue;
    if (Math.abs(a[0] - b[0]) <= AXIS_EPS && Math.abs(a[1] - b[1]) <= AXIS_EPS) continue; // 零长段
    out.push([a, b]);
  }
  return out;
}

/** 值是否落在线段内部（含端点余量）；`lo`/`hi` 是线段的坐标区间。 */
function insideSpan(value: number, lo: number, hi: number, inset: number): boolean {
  const min = Math.min(lo, hi) + inset;
  const max = Math.max(lo, hi) - inset;
  return value >= min && value <= max;
}

/**
 * 算出**每条线要在哪些点拱起**。
 *
 * @param polylines pipeId → 世界坐标折线（`state.points` 的口径）
 */
export function computeLinkJumps(polylines: Map<string, number[][]>): LinkJumps {
  const hops = new Map<string, number[][]>();
  const entries = [...polylines.entries()].filter(([, pts]) => Array.isArray(pts) && pts.length >= 2);

  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const [idA, ptsA] = entries[i];
      const [idB, ptsB] = entries[j];
      for (const segA of segmentsOf(ptsA)) {
        const axisA = axisOf(segA);
        if (!axisA) continue;
        for (const segB of segmentsOf(ptsB)) {
          const axisB = axisOf(segB);
          if (!axisB || axisB === axisA) continue;
          const [hSeg, vSeg] = axisA === 'h' ? [segA, segB] : [segB, segA];
          const [hId] = axisA === 'h' ? [idA, idB] : [idB, idA];
          const cy = hSeg[0][1];
          const cx = vSeg[0][0];
          if (!insideSpan(cx, hSeg[0][0], hSeg[1][0], JUMP_ENDPOINT_INSET)) continue;
          if (!insideSpan(cy, vSeg[0][1], vSeg[1][1], JUMP_ENDPOINT_INSET)) continue;
          pushHop(hops, hId, cx, cy);
        }
      }
    }
  }
  return { hops };
}

function pushHop(hops: Map<string, number[][]>, id: string, x: number, y: number): void {
  const list = hops.get(id);
  const point = [round(x, 2), round(y, 2)];
  if (!list) {
    hops.set(id, [point]);
    return;
  }
  // 同一个交叉点可能被相邻两段各判一次（拐点处），去重
  if (list.some((p) => Math.abs(p[0] - point[0]) < 0.01 && Math.abs(p[1] - point[1]) < 0.01)) return;
  list.push(point);
}

/**
 * 把拱起塞进一条折线的点串里。
 *
 * 每段上落在段内的交叉点，按其在该段上的位置**排序后**逐个插入一段半圆折线；
 * 没有交叉点时**原样返回同一个引用**（调用方据此判断"没变、不用重画"）。
 */
export function applyLinkJumps(points: number[][], hops: ReadonlyArray<number[]> | undefined): number[][] {
  if (!points || points.length < 2 || !hops || hops.length === 0) return points;

  const out: number[][] = [points[0]];
  let changed = false;

  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const axis = axisOf([a, b]);
    if (!axis) {
      out.push(b);
      continue;
    }
    const onSegment = hops
      .filter((h) =>
        axis === 'h'
          ? Math.abs(h[1] - a[1]) <= AXIS_EPS && insideSpan(h[0], a[0], b[0], JUMP_ENDPOINT_INSET)
          : Math.abs(h[0] - a[0]) <= AXIS_EPS && insideSpan(h[1], a[1], b[1], JUMP_ENDPOINT_INSET)
      )
      .map((h) => ({ point: h, t: axis === 'h' ? h[0] - a[0] : h[1] - a[1] }))
      .sort((p, q) => (b[axis === 'h' ? 0 : 1] - a[axis === 'h' ? 0 : 1] >= 0 ? p.t - q.t : q.t - p.t));

    if (onSegment.length === 0) {
      out.push(b);
      continue;
    }

    changed = true;
    for (const item of onSegment) {
      const cx = item.point[0];
      const cy = item.point[1];
      for (let k = 0; k <= JUMP_SEGMENTS; k++) {
        const t = k / JUMP_SEGMENTS;
        const offset = -JUMP_RADIUS + 2 * JUMP_RADIUS * t;
        const bump = JUMP_RADIUS * Math.sin(Math.PI * t);
        out.push(
          axis === 'h' ? [round(cx + offset, 2), round(cy - bump, 2)] : [round(cx + bump, 2), round(cy + offset, 2)]
        );
      }
    }
    out.push(b);
  }

  return changed ? out : points;
}

/**
 * 把拱起**写回一条连线**：重算 world `points` 与本地 `dots`。
 *
 * 引擎的 `state.dots = points - (left, top)`（见 `ICEPolyLine.__calcDots`），
 * 所以两个都要更新 —— 只改 points 的话画布上画的还是旧 dots。
 *
 * @returns 更新后的 dots（渲染与命中都读它）
 */
export function applyJumpsToLink(link: any, jumps: LinkJumps): number[][] {
  const state = link && link.state;
  if (!state || !Array.isArray(state.points)) return state ? state.dots : [];
  const hops = jumps && jumps.hops ? jumps.hops.get(String(state.id)) : undefined;
  if (!hops || hops.length === 0) return state.dots;

  const next = applyLinkJumps(state.points, hops);
  if (next === state.points) return state.dots;

  state.points = next;
  const left = Number(state.left) || 0;
  const top = Number(state.top) || 0;
  state.dots = next.map((p) => [round(p[0] - left, 2), round(p[1] - top, 2)]);
  // 几何被直接改过（没走 setState）→ 派生参数必须一起置脏，否则下一帧又被算回去
  link.paramsDirty = true;
  link.dirty = true;
  return state.dots;
}
