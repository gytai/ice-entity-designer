/**
 * 大米色选工艺图符号库（color-sorter 域）画法函数断言。
 *
 * 每组符号两类断言：
 * 1. shape 函数存在、preset 登记正确（计划给定）；
 * 2. 用对应 preset 真调用一遍画法函数，断言返回 ICEGroup 且 childNodes.length > 0
 *    （否则 18 个画法函数零覆盖，会击穿 test:coverage 棘轮）。
 */
import { ICEGroup } from 'ice-render';
import {
  COLOR_SORTER_SYMBOL_PRESETS,
  rawBinShape,
  bufferBinShape,
  productBinShape,
  rejectBinShape,
} from '../../src/color-sorter/colorSorter_shapes';

describe('color-sorter / 仓斗类符号', () => {
  test.each([
    ['rawBin', rawBinShape],
    ['bufferBin', bufferBinShape],
    ['productBin', productBinShape],
    ['rejectBin', rejectBinShape],
  ] as const)('%s shape 函数存在且返回 ICEGroup', (kind, shape) => {
    expect(shape).toBeDefined();
    expect(typeof shape).toBe('function');
    const group = shape(COLOR_SORTER_SYMBOL_PRESETS[kind]);
    expect(group).toBeInstanceOf(ICEGroup);
    expect(group.childNodes.length).toBeGreaterThan(0);
  });

  test('四个符号都登记在 presets', () => {
    expect(COLOR_SORTER_SYMBOL_PRESETS.rawBin.shape).toBe('tank');
    expect(COLOR_SORTER_SYMBOL_PRESETS.bufferBin.shape).toBe('tank');
    expect(COLOR_SORTER_SYMBOL_PRESETS.productBin.shape).toBe('tank');
    expect(COLOR_SORTER_SYMBOL_PRESETS.rejectBin.shape).toBe('tank');
  });
});
