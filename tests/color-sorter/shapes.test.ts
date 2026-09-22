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
  elevatorShape,
  vibFeederShape,
  colorSorterShape,
  packingScaleShape,
  airCompressorShape,
  airTankShape,
  airDryerShape,
  airFilterShape,
  dustCollectorShape,
  fanShape,
  controlCabinetShape,
  inletShape,
  outletShape,
  rejectOutShape,
  isColorSorterSymbolKind,
  isColorSorterMedium,
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

describe('color-sorter / 提升机 + 喂料器', () => {
  test('elevator shape 存在且返回 ICEGroup', () => {
    expect(typeof elevatorShape).toBe('function');
    expect(COLOR_SORTER_SYMBOL_PRESETS.elevator.shape).toBe('device');
    const group = elevatorShape(COLOR_SORTER_SYMBOL_PRESETS.elevator);
    expect(group).toBeInstanceOf(ICEGroup);
    expect(group.childNodes.length).toBeGreaterThan(0);
  });
  test('vibFeeder shape 存在且返回 ICEGroup', () => {
    expect(typeof vibFeederShape).toBe('function');
    expect(COLOR_SORTER_SYMBOL_PRESETS.vibFeeder.shape).toBe('device');
    const group = vibFeederShape(COLOR_SORTER_SYMBOL_PRESETS.vibFeeder);
    expect(group).toBeInstanceOf(ICEGroup);
    expect(group.childNodes.length).toBeGreaterThan(0);
  });
});

describe('color-sorter / 色选机主机', () => {
  test('shape 存在 + preset，且返回 ICEGroup', () => {
    expect(typeof colorSorterShape).toBe('function');
    expect(COLOR_SORTER_SYMBOL_PRESETS.colorSorter.width).toBe(100);
    expect(COLOR_SORTER_SYMBOL_PRESETS.colorSorter.height).toBe(96);
    const group = colorSorterShape(COLOR_SORTER_SYMBOL_PRESETS.colorSorter);
    expect(group).toBeInstanceOf(ICEGroup);
    expect(group.childNodes.length).toBeGreaterThan(0);
  });
});

describe('color-sorter / 包装秤', () => {
  test('packingScale shape 存在且返回 ICEGroup', () => {
    expect(typeof packingScaleShape).toBe('function');
    expect(COLOR_SORTER_SYMBOL_PRESETS.packingScale.shape).toBe('device');
    const group = packingScaleShape(COLOR_SORTER_SYMBOL_PRESETS.packingScale);
    expect(group).toBeInstanceOf(ICEGroup);
    expect(group.childNodes.length).toBeGreaterThan(0);
  });
});

describe('color-sorter / 气源链四件套', () => {
  test.each([
    ['airCompressor', airCompressorShape],
    ['airTank', airTankShape],
    ['airDryer', airDryerShape],
    ['airFilter', airFilterShape],
  ] as const)('%s shape 函数存在且返回 ICEGroup', (kind, shape) => {
    expect(typeof shape).toBe('function');
    const group = shape(COLOR_SORTER_SYMBOL_PRESETS[kind]);
    expect(group).toBeInstanceOf(ICEGroup);
    expect(group.childNodes.length).toBeGreaterThan(0);
  });

  test('四个符号都登记在 presets', () => {
    expect(COLOR_SORTER_SYMBOL_PRESETS.airCompressor.shape).toBe('device');
    expect(COLOR_SORTER_SYMBOL_PRESETS.airTank.shape).toBe('round');
    expect(COLOR_SORTER_SYMBOL_PRESETS.airDryer.shape).toBe('device');
    expect(COLOR_SORTER_SYMBOL_PRESETS.airFilter.shape).toBe('device');
  });
});

describe('color-sorter / 除尘 + 电控', () => {
  test.each([
    ['dustCollector', dustCollectorShape],
    ['fan', fanShape],
    ['controlCabinet', controlCabinetShape],
  ] as const)('%s shape 函数存在且返回 ICEGroup', (kind, shape) => {
    expect(typeof shape).toBe('function');
    const group = shape(COLOR_SORTER_SYMBOL_PRESETS[kind]);
    expect(group).toBeInstanceOf(ICEGroup);
    expect(group.childNodes.length).toBeGreaterThan(0);
  });

  test('三个符号都登记在 presets', () => {
    expect(COLOR_SORTER_SYMBOL_PRESETS.dustCollector.shape).toBe('device');
    expect(COLOR_SORTER_SYMBOL_PRESETS.fan.shape).toBe('round');
    expect(COLOR_SORTER_SYMBOL_PRESETS.controlCabinet.shape).toBe('device');
  });
});

describe('color-sorter / 边界符号', () => {
  test.each([
    ['inlet', inletShape],
    ['outlet', outletShape],
    ['rejectOut', rejectOutShape],
  ] as const)('%s shape 函数存在且返回 ICEGroup', (kind, shape) => {
    expect(typeof shape).toBe('function');
    const group = shape(COLOR_SORTER_SYMBOL_PRESETS[kind]);
    expect(group).toBeInstanceOf(ICEGroup);
    expect(group.childNodes.length).toBeGreaterThan(0);
  });

  test('三个符号都登记为 boundary', () => {
    expect(COLOR_SORTER_SYMBOL_PRESETS.inlet.shape).toBe('boundary');
    expect(COLOR_SORTER_SYMBOL_PRESETS.outlet.shape).toBe('boundary');
    expect(COLOR_SORTER_SYMBOL_PRESETS.rejectOut.shape).toBe('boundary');
  });
});

describe('color-sorter / 守卫', () => {
  test('isColorSorterSymbolKind 只认 18 种符号', () => {
    expect(isColorSorterSymbolKind('colorSorter')).toBe(true);
    expect(isColorSorterSymbolKind('rawBin')).toBe(true);
    expect(isColorSorterSymbolKind('pump')).toBe(false);
    expect(isColorSorterSymbolKind('')).toBe(false);
  });
  test('isColorSorterMedium 只认 7 种介质', () => {
    expect(isColorSorterMedium('grain')).toBe(true);
    expect(isColorSorterMedium('compressedAir')).toBe(true);
    expect(isColorSorterMedium('sewage')).toBe(false);
    expect(isColorSorterMedium('')).toBe(false);
  });
});
