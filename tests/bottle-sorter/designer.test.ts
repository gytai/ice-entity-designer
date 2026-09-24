/**
 * 整瓶分选工艺图应用层：建图、9 个符号画法路由、管线（介质 + 物料名）、DSL 装载、
 * 交叉跳线桥。
 *
 * 与色选包的 `designer.test.ts` 同一套骨架 —— 这一层卖的不是"画得像"，
 * 而是**画完之后能说清工艺上对不对**（校验器另测，见 validate.test.ts）。
 */
import { ICE, EventBus } from 'ice-render';
import BottleSorterDesigner, {
  BottleSorterPipe,
  BottleSorterSymbol,
  composePipeLabel,
} from '../../src/bottle-sorter/BottleSorterDesigner';
import {
  BOTTLE_SORTER_MEDIUM_STYLES,
  BOTTLE_SORTER_SYMBOL_KINDS,
  BOTTLE_SORTER_SYMBOL_PRESETS,
} from '../../src/bottle-sorter/bottleSorter_shapes';
import type { BottleSorterDslDocument } from '../../src/bottle-sorter/bottleSorter_shapes';
import { JUMP_RADIUS, JUMP_SEGMENTS } from '../../src/designer/linkJumps';

function makeDesigner(doc?: BottleSorterDslDocument): any {
  const ice: any = new ICE();
  ice.evtBus = new EventBus();
  ice.childNodes = [];
  ice.toolNodes = [];
  return new BottleSorterDesigner(ice, doc);
}

/**
 * 一张**故意造出交叉**的最小图：
 * - `a → b` 走底面 / 顶面（竖向主干，x 落在两者中线）；
 * - `c → d` 走左右（横向支线，y 落在两者中线）—— 两条线必然十字相交。
 *
 * 工艺上它对应"下行主干被一条横穿的支线跨过"，正是参考图里那种交叉。
 */
const JUMP_DOC: BottleSorterDslDocument = {
  kind: 'bottle-sorter',
  units: [
    { id: 'a', kind: 'bottleSorter', name: 'AI整瓶机', tag: 'AI-101', left: 300, top: 0 },
    { id: 'b', kind: 'bottleSorter', name: 'AI整瓶机', tag: 'AI-201', left: 300, top: 400 },
    { id: 'c', kind: 'inlet', tag: 'IN', left: 0, top: 200 },
    { id: 'd', kind: 'labelRemover', name: '脱标机', tag: 'LR-101', left: 700, top: 200 },
  ],
  pipes: [
    { id: 'p-trunk', sourceId: 'a', targetId: 'b', medium: 'bottle', sourcePort: 'B', targetPort: 'T' },
    { id: 'p-cross', sourceId: 'c', targetId: 'd', medium: 'bottle', label: '3A' },
  ],
};

describe('bottle-sorter / createSymbolPath 路由', () => {
  it('9 种符号每一种都能取到画法函数', () => {
    expect(BOTTLE_SORTER_SYMBOL_KINDS).toHaveLength(9);
    BOTTLE_SORTER_SYMBOL_KINDS.forEach((kind) => {
      expect(typeof BottleSorterDesigner.createSymbolPath(kind)).toBe('function');
    });
  });

  it('未支持的 kind 抛带 unsupported 的错误', () => {
    expect(() => BottleSorterDesigner.createSymbolPath('not-a-kind' as any)).toThrow(/unsupported/);
    // 色选包的 kind 不属于这个域 —— 跨域误用同样要炸
    expect(() => BottleSorterDesigner.createSymbolPath('colorSorter' as any)).toThrow(/unsupported/);
  });
});

describe('bottle-sorter / createSymbol', () => {
  it('9 种符号都能建出来，且内部形状有内容', () => {
    const d = makeDesigner();
    BOTTLE_SORTER_SYMBOL_KINDS.forEach((kind) => {
      const symbol = d.createSymbol(kind, { left: 0, top: 0 });
      expect(symbol instanceof BottleSorterSymbol).toBe(true);
      expect(symbol.state.kind).toBe(kind);
      expect(symbol.part('shape')).toBeTruthy();
      expect(symbol.part('shape').childNodes.length).toBeGreaterThan(0);
    });
  });

  it('位号在上、名称在下（文字部件按角色可取）', () => {
    const d = makeDesigner();
    const symbol = d.createSymbol('bottleSorter', { name: 'AI整瓶机', tag: 'AI-101', left: 0, top: 0 });
    expect(symbol.part('tag').state.text).toBe('AI-101');
    expect(symbol.part('name').state.text).toBe('AI整瓶机');
  });

  it('不传坐标时自动摆位', () => {
    const d = makeDesigner();
    const symbol = d.createSymbol('drumScreen');
    expect(typeof symbol.state.left).toBe('number');
    expect(typeof symbol.state.top).toBe('number');
  });

  it('名称文字盒按 max(w + 24, 90) 居中 —— 与应用仓的落墨度量模型同一公式', () => {
    const d = makeDesigner();
    const symbol = d.createSymbol('labelRemover', { name: '脱标机', tag: 'LR-101', left: 0, top: 0 });
    const w = BOTTLE_SORTER_SYMBOL_PRESETS.labelRemover.width;
    const labelWidth = Math.max(w + 24, 90);
    expect(symbol.part('name').state.width).toBe(labelWidth);
    expect(symbol.part('name').state.left).toBeCloseTo(w / 2 - labelWidth / 2, 5);
    // 位号在顶边外侧、名称在底边外侧 —— 与布局模型里的 TAG_TOP / NAME_TOP_PAD 对齐
    expect(symbol.part('tag').state.top).toBe(-18);
    expect(symbol.part('name').state.top).toBe(BOTTLE_SORTER_SYMBOL_PRESETS.labelRemover.height + 14);
  });
});

describe('bottle-sorter / 管线', () => {
  it('介质决定颜色 / 线型，三种介质各画各的', () => {
    const d = makeDesigner();
    d.createSymbol('bottleSorter', { id: 'a', left: 0, top: 0 });
    d.createSymbol('bottleBin', { id: 'b', left: 400, top: 0 });
    const pipe = d.createPipe({ id: 'p', sourceId: 'a', targetId: 'b', medium: 'recycle' });
    expect(pipe instanceof BottleSorterPipe).toBe(true);
    expect(pipe.state.style.strokeStyle).toBe(BOTTLE_SORTER_MEDIUM_STYLES.recycle.color);
    expect(pipe.state.label).toBe(BOTTLE_SORTER_MEDIUM_STYLES.recycle.label);
  });

  it('label 优先于「管径 + 介质名」—— 物料名与介质是两件事', () => {
    expect(composePipeLabel('bottle', '', '蓝/白/绿/杂')).toBe('蓝/白/绿/杂');
    expect(composePipeLabel('bottle', '', '')).toBe('整瓶流');
    expect(composePipeLabel('bottle', 'φ200', '')).toBe('φ200 整瓶流');
  });

  it('端点槽位兜底是 R → L（工艺图从左往右）', () => {
    const d = makeDesigner();
    d.createSymbol('bottleSorter', { id: 'a', left: 0, top: 0 });
    d.createSymbol('bottleBin', { id: 'b', left: 400, top: 0 });
    const pipe = d.createPipe({ id: 'p', sourceId: 'a', targetId: 'b', medium: 'bottle' });
    expect(pipe.state.links.start.position).toBe('R');
    expect(pipe.state.links.end.position).toBe('L');
  });

  it('管线两端不存在时抛错（坏文档不该被静默吞掉）', () => {
    const d = makeDesigner();
    d.createSymbol('bottleSorter', { id: 'a', left: 0, top: 0 });
    expect(() => d.createPipe({ id: 'p', sourceId: 'a', targetId: 'ghost', medium: 'bottle' })).toThrow(
      /管线两端必须是已存在的符号/
    );
  });
});

describe('bottle-sorter / DSL 装载', () => {
  it('units / pipes 全部建成，且 nodes / edges 能按类型取回', () => {
    const d = makeDesigner(JUMP_DOC);
    expect(d.nodes.length).toBe(JUMP_DOC.units.length);
    expect(d.edges.length).toBe(JUMP_DOC.pipes.length);
  });

  it('管线引用不存在的单元 → 抛错', () => {
    const bad: BottleSorterDslDocument = {
      kind: 'bottle-sorter',
      units: [{ id: 'a', kind: 'bottleSorter', left: 0, top: 0 }],
      pipes: [{ id: 'p', sourceId: 'a', targetId: 'ghost', medium: 'bottle' }],
    };
    expect(() => makeDesigner(bad)).toThrow();
  });
});

describe('bottle-sorter / 交叉跳线桥', () => {
  /** 先按"无跳线"的口径把每条线的折线算出来，供比较用。 */
  function routePlain(d: any): number[] {
    return d.edges.map((edge: any) => {
      edge.recalculateRoute();
      edge.__calcDots();
      return (edge.state.points as number[][]).length;
    });
  }

  /** 折线首尾必须与端点一致 —— 拱起只许改中间。 */
  function endsIntact(edge: any): boolean {
    const points = edge.state.points as number[][];
    const first = points[0];
    const last = points[points.length - 1];
    return (
      Math.abs(first[0] - edge.state.startPoint[0]) < 0.01 &&
      Math.abs(first[1] - edge.state.startPoint[1]) < 0.01 &&
      Math.abs(last[0] - edge.state.endPoint[0]) < 0.01 &&
      Math.abs(last[1] - edge.state.endPoint[1]) < 0.01
    );
  }

  it('横向支线在交叉点拱起：点数变多、端点不动', () => {
    const d = makeDesigner(JUMP_DOC);
    const plainCounts = routePlain(d);
    const bumped = d.applyLinkJumps();
    expect(bumped).toBeGreaterThan(0);

    const counts = d.edges.map((edge: any) => (edge.state.points as number[][]).length);
    // 拱起会往折线里插采样点：至少有一条线变长，而且长出来的正是拱的采样数
    const grew = counts.map((n: number, i: number) => n - plainCounts[i]).filter((delta: number) => delta > 0);
    expect(grew.length).toBeGreaterThan(0);
    grew.forEach((delta: number) => expect(delta).toBe(JUMP_SEGMENTS + 1)); // 含两个肩点

    d.edges.forEach((edge: any) => expect(endsIntact(edge)).toBe(true));
  });

  it('拱起是真的拱（离基线 ≈ 拱半径），不是抖了一下', () => {
    const d = makeDesigner(JUMP_DOC);
    d.applyLinkJumps();
    const cross = d.edges.find((edge: any) => String(edge.state.id) === 'p-cross');
    const trunk = d.edges.find((edge: any) => String(edge.state.id) === 'p-trunk');
    expect(cross).toBeTruthy();
    expect(trunk).toBeTruthy();

    const points = cross.state.points as number[][];
    const trunkX = (trunk.state.points as number[][])[0][0];
    const bump = points.filter((p: number[]) => Math.abs(p[0] - trunkX) < JUMP_RADIUS - 0.01);
    const shoulders = points.filter((p: number[]) => Math.abs(Math.abs(p[0] - trunkX) - JUMP_RADIUS) < 0.01);
    expect(bump.length).toBeGreaterThan(3);
    expect(shoulders.length).toBe(2);
    // 拱顶比两肩高出一个拱半径，且拱就长在交叉点（竖向主干）正上方
    const apexY = Math.min(...bump.map((p: number[]) => p[1]));
    const shoulderY = Math.max(...shoulders.map((p: number[]) => p[1]));
    expect(shoulderY - apexY).toBeCloseTo(JUMP_RADIUS, 5);
  });

  it('没有交叉的图：applyLinkJumps 返回 0，且不碰任何点', () => {
    const solo: BottleSorterDslDocument = {
      kind: 'bottle-sorter',
      units: [
        { id: 'a', kind: 'bottleSorter', left: 0, top: 0 },
        { id: 'b', kind: 'bottleBin', left: 400, top: 0 },
      ],
      pipes: [{ id: 'p', sourceId: 'a', targetId: 'b', medium: 'bottle' }],
    };
    const d = makeDesigner(solo);
    routePlain(d); // 先把折线算出来，作为比较基准
    const before = (d.edges[0].state.points as number[][]).map((p) => [...p]);
    expect(d.applyLinkJumps()).toBe(0);
    expect(d.edges[0].state.points).toEqual(before);
  });
});
