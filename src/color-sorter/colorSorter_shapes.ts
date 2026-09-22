/**
 * 大米色选工艺图符号库（color-sorter 域）。
 *
 * 记法依据：色选/粮食行业通行画法自绘（无强制性国标图例）。
 * 外观统一（与其它域包同一条铁律）：全部符号共用一套描边色、线宽、字号与基准尺寸，
 * 不可变换。配色约定：
 *   - 暖金色系 = 大米主流、副品；
 *   - 灰色系 = 含尘气流；
 *   - 青色系 = 压缩空气；
 *   - 紫色系 = 信号/动力。
 *
 * 当前架构：kind-first。本文件只输出 shape/preset/medium 颜色与文本，
 * 引擎主题（描边色/字号）由实例 applyDesignerChrome(ice) 派生。
 *
 * （画法函数在后续 task 逐组补全，届时从 ice-render 引入矢量原语。）
 */
export const COLOR_SORTER_SYMBOL_KINDS = [
  // ---- 主料流设备（大米线）----
  'rawBin',
  'bufferBin',
  'elevator',
  'vibFeeder',
  'colorSorter',
  'productBin',
  'rejectBin',
  'packingScale',
  // ---- 气源链 ----
  'airCompressor',
  'airTank',
  'airDryer',
  'airFilter',
  // ---- 除尘 ----
  'dustCollector',
  'fan',
  // ---- 电控 ----
  'controlCabinet',
  // ---- 边界 ----
  'inlet',
  'outlet',
  'rejectOut',
] as const;

export type ColorSorterSymbolKind = (typeof COLOR_SORTER_SYMBOL_KINDS)[number];

export const COLOR_SORTER_MEDIUM_STYLES: Record<
  ColorSorterMedium,
  { label: string; color: string; lineType: 'solid' | 'dashed' | 'dashdot' }
> = {
  grain: { label: '大米主流', color: '#ca8a04', lineType: 'solid' },
  reject: { label: '副品/剔除物', color: '#b91c1c', lineType: 'solid' },
  recycle: { label: '复选回料', color: '#65a30d', lineType: 'solid' },
  compressedAir: { label: '压缩空气', color: '#0891b2', lineType: 'dashed' },
  dustAir: { label: '含尘气流', color: '#64748b', lineType: 'dashed' },
  signal: { label: '仪表信号', color: '#9333ea', lineType: 'dashdot' },
  power: { label: '动力回路', color: '#b45309', lineType: 'dashdot' },
};

export type ColorSorterMedium = 'grain' | 'reject' | 'recycle' | 'compressedAir' | 'dustAir' | 'signal' | 'power';

export interface ColorSorterSymbolPreset {
  label: string;
  tag: string;
  width: number;
  height: number;
  shape: 'tank' | 'round' | 'device' | 'boundary';
  inline: boolean;
}

export const COLOR_SORTER_SYMBOL_PRESETS: Record<ColorSorterSymbolKind, ColorSorterSymbolPreset> = {
  rawBin: { label: '原料仓', tag: 'B', width: 86, height: 80, shape: 'tank', inline: false },
  bufferBin: { label: '缓冲斗', tag: 'B', width: 86, height: 68, shape: 'tank', inline: false },
  productBin: { label: '成品斗', tag: 'B', width: 86, height: 68, shape: 'tank', inline: false },
  rejectBin: { label: '副品斗', tag: 'B', width: 86, height: 52, shape: 'tank', inline: false },
  elevator: { label: '斗式提升机', tag: 'E', width: 64, height: 80, shape: 'device', inline: false },
  vibFeeder: { label: '振动喂料器', tag: 'VF', width: 84, height: 36, shape: 'device', inline: false },
  colorSorter: { label: '色选机', tag: 'CS', width: 100, height: 96, shape: 'device', inline: false },
  packingScale: { label: '包装秤', tag: 'PK', width: 86, height: 68, shape: 'device', inline: false },
  airCompressor: { label: '空压机', tag: 'AC', width: 92, height: 56, shape: 'device', inline: false },
  airTank: { label: '储气罐', tag: 'AT', width: 70, height: 84, shape: 'round', inline: false },
  airDryer: { label: '冷干机', tag: 'AD', width: 92, height: 56, shape: 'device', inline: false },
  airFilter: { label: '精密过滤器', tag: 'AF', width: 88, height: 70, shape: 'device', inline: false },
  dustCollector: { label: '布袋除尘器', tag: 'DC', width: 100, height: 76, shape: 'device', inline: false },
  fan: { label: '离心风机', tag: 'F', width: 76, height: 70, shape: 'round', inline: false },
  controlCabinet: { label: '电控柜', tag: 'PLC', width: 86, height: 76, shape: 'device', inline: false },
  inlet: { label: '来米', tag: 'IN', width: 86, height: 36, shape: 'boundary', inline: false },
  outlet: { label: '成品出库', tag: 'OUT', width: 96, height: 40, shape: 'boundary', inline: false },
  rejectOut: { label: '副品外售', tag: 'RJ', width: 96, height: 40, shape: 'boundary', inline: false },
};

// 符号画法组将在后续 task 补全
// （rawBinShape / bufferBinShape / ... / boundaryShapes）
export function isColorSorterSymbolKind(kind: string): kind is ColorSorterSymbolKind {
  return (COLOR_SORTER_SYMBOL_KINDS as readonly string[]).indexOf(kind) !== -1;
}

export function isColorSorterMedium(m: string): m is ColorSorterMedium {
  return m in COLOR_SORTER_MEDIUM_STYLES;
}
