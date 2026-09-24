/**
 * 整瓶分选工艺图 DSL 校验器：三条域内约束（来料有去处 / 瓶仓有来源 / 瓶仓带秤）。
 *
 * 判据是"**永不抛、只给结构化诊断**" —— 卡片那条自修复回路靠它回灌给模型修正。
 */
import { validateBottleSorter } from '../../src/bottle-sorter/validateBottleSorter';
import type { BottleSorterDslDocument } from '../../src/bottle-sorter/bottleSorter_shapes';

/** 一份**合法**的整瓶图：来料 → 分选机 → 仓 → 秤。 */
function baseDoc(): BottleSorterDslDocument {
  return {
    kind: 'bottle-sorter',
    units: [
      { id: 'in', kind: 'inlet', tag: 'IN', left: 0, top: 0 },
      { id: 'ai1', kind: 'bottleSorter', name: 'AI整瓶机', tag: 'AI-101', left: 200, top: 0 },
      { id: 'bin1', kind: 'bottleBin', name: '3A瓶仓', tag: 'B-3A', left: 400, top: 0 },
      { id: 'w1', kind: 'bottleScale', name: '3A瓶称重', tag: 'W-3A', left: 400, top: 200 },
    ],
    pipes: [
      { id: 'p1', sourceId: 'in', targetId: 'ai1', medium: 'bottle' },
      { id: 'p2', sourceId: 'ai1', targetId: 'bin1', medium: 'bottle' },
      { id: 'p3', sourceId: 'bin1', targetId: 'w1', medium: 'bottle' },
    ],
  };
}

describe('validateBottleSorter / 通用结构', () => {
  it('合法文档：零错误零警告', () => {
    const result = validateBottleSorter(baseDoc());
    expect(result.errors).toEqual([]);
    expect(result.valid).toBe(true);
  });

  it('非对象 / kind 不对：直接返回，不抛', () => {
    expect(validateBottleSorter(null).valid).toBe(false);
    expect(validateBottleSorter([]).valid).toBe(false);
    expect(validateBottleSorter({ kind: 'color-sorter' }).errors[0].message).toMatch(/bottle-sorter/);
  });

  it('未知符号种类 / 未知介质 / 端点不存在都被指出来', () => {
    const doc: any = baseDoc();
    doc.units[1].kind = 'colorSorter';
    doc.pipes[1].medium = 'grain';
    doc.pipes[0].targetId = 'ghost';
    const paths = validateBottleSorter(doc).errors.map((e) => e.path);
    expect(paths).toContain('units[ai1].kind');
    expect(paths).toContain('pipes[p2].medium');
    expect(paths).toContain('pipes[p1].targetId');
  });
});

describe('validateBottleSorter / 三条域内工艺约束', () => {
  it('① 来料必须有去处', () => {
    const doc: any = baseDoc();
    doc.pipes = doc.pipes.filter((p: any) => p.id !== 'p1');
    const result = validateBottleSorter(doc);
    expect(result.valid).toBe(false);
    expect(result.errors.map((e) => e.message).join()).toMatch(/来料 .* 必须接到下游/);
  });

  it('② 分色瓶仓必须有来源', () => {
    const doc: any = baseDoc();
    doc.pipes = doc.pipes.filter((p: any) => p.id !== 'p2');
    const result = validateBottleSorter(doc);
    expect(result.valid).toBe(false);
    expect(result.errors.map((e) => e.message).join()).toMatch(/分色瓶仓 .* 必须有来源/);
  });

  it('③ 分色瓶仓必须下接一台称重秤', () => {
    const doc: any = baseDoc();
    doc.pipes = doc.pipes.filter((p: any) => p.id !== 'p3');
    const result = validateBottleSorter(doc);
    expect(result.valid).toBe(false);
    expect(result.errors.map((e) => e.message).join()).toMatch(/必须下接一台称重秤/);
  });

  it('诊断条数有上限（坏文档不刷屏）', () => {
    const doc: any = baseDoc();
    for (let i = 0; i < 20; i++) {
      doc.units.push({ id: `bin${i}`, kind: 'bottleBin', left: 0, top: 0 });
    }
    const result = validateBottleSorter(doc);
    expect(result.errors.length).toBeLessThanOrEqual(8);
  });
});
