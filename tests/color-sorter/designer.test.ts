/**
 * 色选工艺图应用层：建图、18 个符号画法路由、管线（介质 + 管径）、DSL 装载、删除级联。
 *
 * 与给水排水包的 `water-designer.test.ts` 同一套骨架 —— 这一层卖的不是"画得像"，
 * 而是**画完之后能说清工艺上对不对**（校验器另测，见 validate.test.ts）。
 */
import { ICE, EventBus } from 'ice-render';
import ColorSorterDesigner, { ColorSorterPipe, ColorSorterSymbol } from '../../src/color-sorter/ColorSorterDesigner';
import { COLOR_SORTER_SYMBOL_KINDS } from '../../src/color-sorter/colorSorter_shapes';
import type { ColorSorterDslDocument } from '../../src/color-sorter/colorSorter_shapes';

function makeDesigner(doc?: ColorSorterDslDocument): any {
  const ice: any = new ICE();
  ice.evtBus = new EventBus();
  ice.childNodes = [];
  ice.toolNodes = [];
  return new ColorSorterDesigner(ice, doc);
}

describe('color-sorter / createSymbolPath 路由', () => {
  it('18 种符号每一种都能取到画法函数', () => {
    expect(COLOR_SORTER_SYMBOL_KINDS).toHaveLength(18);
    COLOR_SORTER_SYMBOL_KINDS.forEach((kind) => {
      const fn = ColorSorterDesigner.createSymbolPath(kind);
      expect(typeof fn).toBe('function');
    });
  });

  it('未支持的 kind 抛带 unsupported 的错误', () => {
    expect(() => ColorSorterDesigner.createSymbolPath('not-a-kind' as any)).toThrow(/unsupported/);
    expect(() => ColorSorterDesigner.createSymbolPath('pump' as any)).toThrow(/unsupported/);
  });
});

describe('color-sorter / createSymbol', () => {
  it('18 种符号都能建出来，且内部形状有内容', () => {
    const d = makeDesigner();
    COLOR_SORTER_SYMBOL_KINDS.forEach((kind) => {
      const symbol = d.createSymbol(kind, { left: 0, top: 0 });
      expect(symbol instanceof ColorSorterSymbol).toBe(true);
      expect(symbol.state.kind).toBe(kind);
      expect(symbol.part('shape')).toBeTruthy();
      expect(symbol.part('shape').childNodes.length).toBeGreaterThan(0);
    });
  });

  it('位号在上、名称在下（文字部件按角色可取）', () => {
    const d = makeDesigner();
    const symbol = d.createSymbol('colorSorter', { name: '色选机', tag: 'CS-201', left: 0, top: 0 });
    expect(symbol.part('tag').state.text).toBe('CS-201');
    expect(symbol.part('name').state.text).toBe('色选机');
  });

  it('不传坐标时自动摆位', () => {
    const d = makeDesigner();
    const symbol = d.createSymbol('rawBin');
    expect(typeof symbol.state.left).toBe('number');
    expect(typeof symbol.state.top).toBe('number');
  });

  it('改 kind 会重建内部形状（派生部件不进文档）', () => {
    const d = makeDesigner();
    const symbol = d.createSymbol('rawBin', { left: 0, top: 0 });
    expect(symbol.getSerializableChildren()).toHaveLength(0);
    symbol.setState({ kind: 'colorSorter' });
    expect(symbol.state.kind).toBe('colorSorter');
    expect(symbol.part('shape')).toBeTruthy();
    expect(symbol.getSerializableChildren()).toHaveLength(0);
  });

  it('未知 kind 不抛（渲染层宽容，诊断交给校验器）', () => {
    const d = makeDesigner();
    expect(() => d.createSymbol('unknown-kind' as any, { left: 0, top: 0 })).not.toThrow();
  });
});

describe('color-sorter / createPipe', () => {
  it('建出来的是 ColorSorterPipe，带介质与管径并据此着色/定线型', () => {
    const d = makeDesigner();
    const ac = d.createSymbol('airCompressor', { left: 0, top: 0 });
    const cs = d.createSymbol('colorSorter', { left: 200, top: 0 });
    const air = d.createPipe({ id: 'p1', sourceId: ac.state.id, targetId: cs.state.id, medium: 'compressedAir' });
    expect(air instanceof ColorSorterPipe).toBe(true);
    expect(air.state.medium).toBe('compressedAir');
    expect(air.state.label).toContain('压缩空气');
    // 压缩空气是虚线（不是米流）
    expect(air.state.lineType).toBe('dashed');

    const grain = d.createPipe({ id: 'p2', sourceId: cs.state.id, targetId: ac.state.id, medium: 'grain', dn: 'φ219' });
    expect(grain.state.lineType).toBe('solid');
    expect(grain.state.label).toContain('φ219');
    expect(grain.state.style.strokeStyle).not.toBe(air.state.style.strokeStyle);
  });

  it('点划线介质靠 lineDash 表达（引擎只认 solid/dashed）', () => {
    const d = makeDesigner();
    const a = d.createSymbol('controlCabinet', { left: 0, top: 0 });
    const b = d.createSymbol('colorSorter', { left: 200, top: 0 });
    const signal = d.createPipe({ id: 'p1', sourceId: a.state.id, targetId: b.state.id, medium: 'signal' });
    expect(signal.state.lineType).toBe('dashed');
    expect(signal.state.lineDash.length).toBeGreaterThan(0);
  });

  it('未知介质按大米主流处理（不抛错）', () => {
    const d = makeDesigner();
    const a = d.createSymbol('inlet', { left: 0, top: 0 });
    const b = d.createSymbol('outlet', { left: 200, top: 0 });
    expect(() =>
      d.createPipe({ id: 'p1', sourceId: a.state.id, targetId: b.state.id, medium: 'unknown' })
    ).not.toThrow();
  });

  it('端点不存在时抛错', () => {
    const d = makeDesigner();
    const a = d.createSymbol('inlet', { left: 0, top: 0 });
    expect(() => d.createPipe({ sourceId: a.state.id, targetId: 'nope', medium: 'grain' })).toThrow();
  });

  it('setMedium 改介质后线型跟着变', () => {
    const d = makeDesigner();
    const a = d.createSymbol('inlet', { left: 0, top: 0 });
    const b = d.createSymbol('outlet', { left: 200, top: 0 });
    const pipe = d.createPipe({ id: 'p1', sourceId: a.state.id, targetId: b.state.id, medium: 'grain' });
    pipe.setMedium('dustAir');
    expect(pipe.state.medium).toBe('dustAir');
    expect(pipe.state.lineType).toBe('dashed');
  });
});

describe('color-sorter / nodes · edges · remove', () => {
  it('nodes / edges 只认本包的符号与管线', () => {
    const d = makeDesigner();
    const a = d.createSymbol('inlet', { left: 0, top: 0 });
    const b = d.createSymbol('outlet', { left: 200, top: 0 });
    d.createPipe({ id: 'p1', sourceId: a.state.id, targetId: b.state.id, medium: 'grain' });
    expect(d.nodes).toHaveLength(2);
    expect(d.edges).toHaveLength(1);
  });

  it('删符号时挂在它身上的管线一起删（不留悬空线）', () => {
    const d = makeDesigner();
    const a = d.createSymbol('inlet', { left: 0, top: 0 });
    const b = d.createSymbol('outlet', { left: 200, top: 0 });
    d.createPipe({ id: 'p1', sourceId: a.state.id, targetId: b.state.id, medium: 'grain' });
    d.remove(a.state.id);
    expect(d.nodes).toHaveLength(1);
    expect(d.edges).toHaveLength(0);
  });
});

describe('color-sorter / mount（DSL 装载）', () => {
  const doc: ColorSorterDslDocument = {
    kind: 'color-sorter',
    units: [
      { id: 'in', kind: 'inlet', name: '来米', tag: 'IN', left: 0, top: 0 },
      { id: 'cs', kind: 'colorSorter', name: '色选机', tag: 'CS-201', left: 200, top: 0 },
      { id: 'out', kind: 'outlet', name: '成品出库', tag: 'OUT', left: 400, top: 0 },
    ],
    pipes: [
      { id: 'p1', sourceId: 'in', targetId: 'cs', medium: 'grain' },
      { id: 'p2', sourceId: 'cs', targetId: 'out', medium: 'grain' },
    ],
  };

  it('构造期带文档 → 直接建好', () => {
    const d = makeDesigner(doc);
    expect(d.nodes).toHaveLength(3);
    expect(d.edges).toHaveLength(2);
  });

  it('mount() 返回建出的数量，单元 id 与文档一致', () => {
    const d = makeDesigner();
    const report = d.mount(doc);
    expect(report).toEqual({ units: 3, pipes: 2 });
    expect(d.nodes.map((node: any) => node.state.id).sort()).toEqual(['cs', 'in', 'out']);
  });

  it('管线引用不存在的单元 → 抛错（坏文档不静默吞）', () => {
    const d = makeDesigner();
    const bad: ColorSorterDslDocument = {
      kind: 'color-sorter',
      units: [{ id: 'in', kind: 'inlet', left: 0, top: 0 }],
      pipes: [{ id: 'p1', sourceId: 'in', targetId: 'ghost', medium: 'grain' }],
    };
    expect(() => d.mount(bad)).toThrow();
  });
});

describe('color-sorter / 快照往返', () => {
  it('建图 → 序列化 → 载入，单元与管线数量不变', () => {
    const d = makeDesigner();
    const a = d.createSymbol('inlet', { id: 'in', left: 0, top: 0 });
    const b = d.createSymbol('colorSorter', { id: 'cs', left: 200, top: 0 });
    d.createPipe({ id: 'p1', sourceId: a.state.id, targetId: b.state.id, medium: 'grain', dn: 'φ219' });

    const json = d.serialize();
    const d2 = makeDesigner();
    const report = d2.load(json);
    expect(report.nodes).toBe(2);
    expect(report.edges).toBe(1);
    expect(d2.nodes).toHaveLength(2);
    expect(d2.edges).toHaveLength(1);
  });
});
