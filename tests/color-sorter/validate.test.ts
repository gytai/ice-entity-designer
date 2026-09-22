/**
 * 色选工艺图校验器：**永不抛异常 + 四条色选特有工艺约束**。
 *
 * 四条约束各一条断言（缺气源 / 成品没出路 / 副品没出路 / 喂料器接反），
 * 外加通用结构（id 唯一、种类与介质取值、管线两端存在）与"坏输入不炸"的护栏。
 */
import { validateColorSorter } from '../../src/color-sorter/validateColorSorter';
import type { ColorSorterDslDocument } from '../../src/color-sorter/colorSorter_shapes';

/** 一份干净的最小文档：喂料器在色选机上游、色选机接压缩空气、成品与副品都有出路 */
const okDoc: ColorSorterDslDocument = {
  kind: 'color-sorter',
  units: [
    { id: 'vf', kind: 'vibFeeder', left: -200, top: 0 },
    { id: 'cs1', kind: 'colorSorter', left: 0, top: 0 },
    { id: 'out', kind: 'outlet', left: 200, top: 0 },
    { id: 'rj', kind: 'rejectOut', left: 200, top: 100 },
    { id: 'ac', kind: 'airCompressor', left: 0, top: 100 },
  ],
  pipes: [
    { id: 'p-feed', sourceId: 'vf', targetId: 'cs1', medium: 'grain' },
    { id: 'p-grain', sourceId: 'cs1', targetId: 'out', medium: 'grain' },
    { id: 'p-reject', sourceId: 'cs1', targetId: 'rj', medium: 'reject' },
    { id: 'p-air', sourceId: 'ac', targetId: 'cs1', medium: 'compressedAir' },
  ],
};

const messages = (doc: any): string[] => validateColorSorter(doc).errors.map((item) => item.message);

describe('color-sorter / validateColorSorter · 干净文档', () => {
  it('合法文档 → valid=true，errors=[]', () => {
    const result = validateColorSorter(okDoc);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
  });
});

describe('color-sorter / validateColorSorter · 四条工艺约束', () => {
  it('① 色选机没接压缩空气 → error', () => {
    const doc = { ...okDoc, pipes: okDoc.pipes.filter((pipe) => pipe.medium !== 'compressedAir') };
    const result = validateColorSorter(doc);
    expect(result.valid).toBe(false);
    expect(messages(doc).some((message) => /compressedAir/.test(message))).toBe(true);
  });

  it('② 没有 outlet → error: 成品必须有出路', () => {
    const doc = {
      ...okDoc,
      units: okDoc.units.filter((unit) => unit.kind !== 'outlet'),
      pipes: okDoc.pipes.filter((pipe) => pipe.id !== 'p-grain'),
    };
    expect(messages(doc).some((message) => /成品/.test(message))).toBe(true);
  });

  it('② outlet 存在但没被连入 → 同样报"成品必须有出路"', () => {
    const doc = { ...okDoc, pipes: okDoc.pipes.filter((pipe) => pipe.id !== 'p-grain') };
    expect(messages(doc).some((message) => /成品/.test(message))).toBe(true);
  });

  it('③ 副品斗没接 rejectOut / recycle → error', () => {
    const doc = {
      ...okDoc,
      units: [...okDoc.units, { id: 'rb', kind: 'rejectBin', left: 0, top: 200 }],
    };
    expect(messages(doc).some((message) => /副品/.test(message))).toBe(true);
  });

  it('③ 副品斗接到 rejectOut → 不再报副品', () => {
    const doc = {
      ...okDoc,
      units: [...okDoc.units, { id: 'rb', kind: 'rejectBin', left: 0, top: 200 }],
      pipes: [...okDoc.pipes, { id: 'p-rb-rj', sourceId: 'rb', targetId: 'rj', medium: 'reject' }],
    };
    const result = validateColorSorter(doc);
    expect(result.valid).toBe(true);
    expect(messages(doc).some((message) => /副品/.test(message))).toBe(false);
  });

  it('③ 副品斗走 recycle 回料 → 同样算有出路', () => {
    const doc = {
      ...okDoc,
      units: [...okDoc.units, { id: 'rb', kind: 'rejectBin', left: 0, top: 200 }],
      pipes: [...okDoc.pipes, { id: 'p-rb-cs', sourceId: 'rb', targetId: 'cs1', medium: 'recycle' }],
    };
    expect(validateColorSorter(doc).valid).toBe(true);
  });

  it('④ 喂料器接到色选机下游 → error', () => {
    const doc = {
      ...okDoc,
      pipes: [...okDoc.pipes, { id: 'p-bad', sourceId: 'cs1', targetId: 'vf', medium: 'grain' }],
    };
    expect(messages(doc).some((message) => /喂料器必须在色选机上游/.test(message))).toBe(true);
  });
});

describe('color-sorter / validateColorSorter · 通用结构', () => {
  it('未知符号种类 → error', () => {
    const doc = { ...okDoc, units: [...okDoc.units, { id: 'x', kind: 'pump', left: 0, top: 0 }] };
    expect(messages(doc).some((message) => /未知符号种类/.test(message))).toBe(true);
  });

  it('未知介质 → error', () => {
    const doc = {
      ...okDoc,
      pipes: [...okDoc.pipes, { id: 'p-x', sourceId: 'cs1', targetId: 'out', medium: 'sewage' }],
    };
    expect(messages(doc).some((message) => /未知介质/.test(message))).toBe(true);
  });

  it('管线引用不存在的单元 → error', () => {
    const doc = {
      ...okDoc,
      pipes: [...okDoc.pipes, { id: 'p-x', sourceId: 'ghost', targetId: 'out', medium: 'grain' }],
    };
    expect(messages(doc).some((message) => /不存在/.test(message))).toBe(true);
  });

  it('id 重复 → error', () => {
    const doc = { ...okDoc, units: [...okDoc.units, { id: 'cs1', kind: 'colorSorter', left: 0, top: 0 }] };
    expect(messages(doc).some((message) => /id 重复/.test(message))).toBe(true);
  });

  it('单元缺 id → error', () => {
    const doc = { ...okDoc, units: [{ kind: 'colorSorter', left: 0, top: 0 }] };
    expect(messages(doc).some((message) => /必须有 id/.test(message))).toBe(true);
  });

  it('units / pipes 缺失 → warning，不抛', () => {
    const result = validateColorSorter({ kind: 'color-sorter' });
    expect(result.warnings).toHaveLength(2);
    expect(result.valid).toBe(false); // 成品没出路
  });
});

describe('color-sorter / validateColorSorter · 永不抛异常', () => {
  it('null / undefined / 空对象 / 数组 / 标量都不抛', () => {
    const inputs: any[] = [null, undefined, {}, [], 'x', 42, { kind: 'water-process' }, { kind: 'color-sorter' }];
    inputs.forEach((input) => {
      expect(() => validateColorSorter(input)).not.toThrow();
      const result = validateColorSorter(input);
      expect(Array.isArray(result.errors)).toBe(true);
      expect(Array.isArray(result.warnings)).toBe(true);
    });
  });

  it('units 里混进坏元素（null / 非对象）也不抛', () => {
    const doc = {
      kind: 'color-sorter',
      units: [null, 7, { id: 'ok', kind: 'colorSorter', left: 0, top: 0 }],
      pipes: [null],
    };
    expect(() => validateColorSorter(doc)).not.toThrow();
  });

  it('kind 不对 → 直接返回 kind 错误', () => {
    const result = validateColorSorter({ kind: 'water-process', units: [], pipes: [] });
    expect(result.valid).toBe(false);
    expect(result.errors[0].path).toBe('kind');
  });
});
