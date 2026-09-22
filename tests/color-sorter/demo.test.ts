/**
 * 最小示例（examples/color-sorter-demo.ts）：12 单元 / 18 管线。
 *
 * 示例文件本身不会被 jest 收集，这里把它拉进来跑一遍 —— 否则"示例"永远是死代码，
 * 符号改坏了也没人知道。断言三件事：规模对得上、校验干净、能真的建到设计器里。
 */
import { ICE, EventBus } from 'ice-render';
import ColorSorterDesigner from '../../src/color-sorter/ColorSorterDesigner';
import { validateColorSorter } from '../../src/color-sorter/validateColorSorter';
import { COLOR_SORTER_DEMO_DOC, buildColorSorterDemo } from '../../examples/color-sorter-demo';
import { isColorSorterSymbolKind } from '../../src/color-sorter/colorSorter_shapes';

function makeDesigner(): any {
  const ice: any = new ICE();
  ice.evtBus = new EventBus();
  ice.childNodes = [];
  ice.toolNodes = [];
  return new ColorSorterDesigner(ice);
}

describe('color-sorter / 最小示例', () => {
  it('12 单元 / 18 管线', () => {
    expect(COLOR_SORTER_DEMO_DOC.units).toHaveLength(12);
    expect(COLOR_SORTER_DEMO_DOC.pipes).toHaveLength(18);
  });

  it('单元 id 唯一，符号种类都是登记过的 18 种', () => {
    const ids = COLOR_SORTER_DEMO_DOC.units.map((unit) => unit.id);
    expect(new Set(ids).size).toBe(ids.length);
    COLOR_SORTER_DEMO_DOC.units.forEach((unit) => {
      expect(isColorSorterSymbolKind(unit.kind)).toBe(true);
    });
  });

  it('通过四条工艺约束（valid=true）', () => {
    const result = validateColorSorter(COLOR_SORTER_DEMO_DOC);
    expect(result.errors).toEqual([]);
    expect(result.valid).toBe(true);
  });

  it('能建到设计器里：12 个符号 / 18 条管线', () => {
    const designer = makeDesigner();
    const report = buildColorSorterDemo(designer);
    expect(report).toEqual({ units: 12, pipes: 18 });
    expect(designer.nodes).toHaveLength(12);
    expect(designer.edges).toHaveLength(18);
  });

  it('三种线型都用到（实线米流 / 虚线气与尘 / 点划线信号）——本图覆盖前两种', () => {
    const mediums = new Set(COLOR_SORTER_DEMO_DOC.pipes.map((pipe) => pipe.medium));
    expect(mediums.has('grain')).toBe(true);
    expect(mediums.has('reject')).toBe(true);
    expect(mediums.has('recycle')).toBe(true);
    expect(mediums.has('compressedAir')).toBe(true);
    expect(mediums.has('dustAir')).toBe(true);
  });
});
