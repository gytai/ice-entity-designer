/**
 * 连线交叉跳线桥（`src/designer/linkJumps.ts`）：纯几何，两张工艺图共用。
 *
 * 这里判的是"算得对不对"：交叉识别、拱点插入、端点不动、同向不判。
 * 应用层怎么用它（写回连线、每次重算几何后重新套用）在 `tests/bottle-sorter/designer.test.ts`。
 */
import { applyLinkJumps, computeLinkJumps, JUMP_ENDPOINT_INSET, JUMP_RADIUS } from '../../src/designer/linkJumps';

/** 一条横向直线段。 */
const hLine = (y: number, x0: number, x1: number): number[][] => [
  [x0, y],
  [x1, y],
];

/** 一条纵向直线段。 */
const vLine = (x: number, y0: number, y1: number): number[][] => [
  [x, y0],
  [x, y1],
];

describe('computeLinkJumps', () => {
  it('横竖十字交叉：横向线拱起，竖向线不动', () => {
    const { hops } = computeLinkJumps(
      new Map([
        ['h', hLine(200, 0, 400)],
        ['v', vLine(100, 0, 400)],
      ])
    );
    expect(hops.get('h')).toEqual([[100, 200]]);
    expect(hops.get('v')).toBeUndefined();
  });

  it('同向的两条线不判交叉（并排 / 共线都不算）', () => {
    const { hops } = computeLinkJumps(
      new Map([
        ['a', hLine(200, 0, 400)],
        ['b', hLine(200, 100, 500)],
        ['c', hLine(260, 0, 400)],
      ])
    );
    expect(hops.size).toBe(0);
  });

  it('交叉点离端点太近（拱不开）→ 不拱', () => {
    const tooClose = JUMP_ENDPOINT_INSET - 1;
    const { hops } = computeLinkJumps(
      new Map([
        ['h', hLine(200, 1000, 1000 + tooClose * 2)],
        ['v', vLine(1000 + tooClose, 0, 400)],
      ])
    );
    expect(hops.size).toBe(0);
  });

  it('斜线一律跳过（正交布线之外不猜）', () => {
    const diagonal: number[][] = [
      [0, 0],
      [200, 200],
    ];
    const { hops } = computeLinkJumps(
      new Map([
        ['d', diagonal],
        ['v', vLine(100, 0, 400)],
      ])
    );
    expect(hops.size).toBe(0);
  });

  it('一条线上多个交叉：全部记下来', () => {
    const { hops } = computeLinkJumps(
      new Map([
        ['h', hLine(200, 0, 500)],
        ['v1', vLine(100, 0, 400)],
        ['v2', vLine(300, 0, 400)],
      ])
    );
    expect(hops.get('h')).toEqual([
      [100, 200],
      [300, 200],
    ]);
  });

  it('折线（主干拐弯 + 一条横穿）也能判到', () => {
    const trunk: number[][] = [
      [100, 0],
      [100, 300],
      [400, 300],
    ];
    const { hops } = computeLinkJumps(
      new Map([
        ['trunk', trunk],
        ['cross', hLine(150, 0, 500)],
      ])
    );
    // 横向线在 (100,150) 处与主干的竖段交叉
    expect(hops.get('cross')).toEqual([[100, 150]]);
  });
});

describe('applyLinkJumps', () => {
  it('拱起段：起点不动、终点不动，中间插入一段半圆', () => {
    const points = hLine(200, 0, 400);
    const out = applyLinkJumps(points, [[200, 200]]);
    expect(out[0]).toEqual([0, 200]);
    expect(out[out.length - 1]).toEqual([400, 200]);
    // 半圆最高点：y = 200 - 6
    const minY = Math.min(...out.map((p) => p[1]));
    expect(minY).toBeCloseTo(200 - JUMP_RADIUS, 5);
    // 拱的两肩落在 (194, 200) / (206, 200)
    expect(out.some((p) => Math.abs(p[0] - 194) < 0.01 && Math.abs(p[1] - 200) < 0.01)).toBe(true);
    expect(out.some((p) => Math.abs(p[0] - 206) < 0.01 && Math.abs(p[1] - 200) < 0.01)).toBe(true);
    // 拱内不出现"回到基线上"的点（否则就是断成两截了）
    expect(out.filter((p) => Math.abs(p[1] - 200) < 0.01 && p[0] > 194 && p[0] < 206)).toEqual([]);
  });

  it('没有拱点时原样返回同一个引用（调用方据此判断"没变"）', () => {
    const points = hLine(200, 0, 400);
    expect(applyLinkJumps(points, [])).toBe(points);
    expect(applyLinkJumps(points, undefined)).toBe(points);
    // 拱点不在任何一段上，同样不碰
    expect(applyLinkJumps(points, [[800, 200]])).toBe(points);
  });

  it('竖向段上的拱点朝 +x 鼓起（横向拱的镜像）', () => {
    const points = vLine(100, 0, 400);
    const out = applyLinkJumps(points, [[100, 200]]);
    const maxX = Math.max(...out.map((p) => p[0]));
    expect(maxX).toBeCloseTo(100 + JUMP_RADIUS, 5);
    expect(out[0]).toEqual([100, 0]);
    expect(out[out.length - 1]).toEqual([100, 400]);
  });

  it('一条折线上的多个拱点按沿线顺序插入', () => {
    const points = hLine(200, 0, 500);
    const out = applyLinkJumps(points, [
      [300, 200],
      [100, 200],
    ]);
    const bumpXs = out.filter((p) => Math.abs(p[1] - 200) < 0.01 && p[0] > 0).map((p) => p[0]);
    // 先遇到 100 的拱、再遇到 300 的拱 —— 两肩的 x 递增
    expect(bumpXs.indexOf(94)).toBeLessThan(bumpXs.indexOf(294));
  });
});
