/**
 * 大米色选工艺图最小示例（12 单元 / 18 管线）。
 *
 * 用途：**新符号的视觉验证** —— 把 `colorSorter_shapes` 的画法函数按真实工艺接起来跑一遍，
 * 一眼能看出符号画得像不像、管线介质颜色分不分得开。完整案例（27 单元 / 45 管线）在应用层
 * （`ice-agent-console/shared/color-sorter-case.ts`），这里刻意保持最小：
 *
 * ```
 *   主米流  来米 → 原料仓 → 提升机 → 振动喂料器 → 色选机 → 成品斗 → 包装秤 → 成品出库
 *   副品                            └→ 副品斗 → 副品外售（并回色选机复选）
 *   气源    空压机 →（色选机喷阀 / 包装秤 / 除尘器脉冲清灰）
 *   除尘    原料仓 / 提升机 / 振动喂料器 / 色选机 / 成品斗 → 布袋除尘器
 * ```
 *
 * 这份文档**通过 `validateColorSorter` 的四条工艺约束**（tests/color-sorter/demo.test.ts 会盯住这一点）：
 * 色选机接了压缩空气、成品有 outlet 出路、副品接 rejectOut 且回料复选、喂料器在色选机上游。
 *
 * 它不是"页面"：示例页（`examples/*.html`）在应用层那一侧，本文件是那份页面 / 单测共用的**数据源**。
 */
import type { ColorSorterDslDocument } from '../src/color-sorter/colorSorter_shapes';
import type ColorSorterDesigner from '../src/color-sorter/ColorSorterDesigner';

/** 主米流带（y = 0，左 → 右） */
const MAIN_LINE_Y = 0;
/** 副品带（y = 200） */
const REJECT_Y = 200;
/** 气源 / 除尘带（y = 400） */
const UTILITY_Y = 400;

export const COLOR_SORTER_DEMO_DOC: ColorSorterDslDocument = {
  kind: 'color-sorter',
  title: '大米色选工艺图（最小示例）',
  viewport: { focus: ['in', 'raw', 'ele', 'vf', 'cs', 'pbin', 'pk', 'out'] },
  units: [
    // ---- 主米流带 ----
    { id: 'in', kind: 'inlet', name: '来米', tag: 'IN', left: 0, top: MAIN_LINE_Y },
    { id: 'raw', kind: 'rawBin', name: '原料仓', tag: 'B-101', left: 160, top: MAIN_LINE_Y },
    { id: 'ele', kind: 'elevator', name: '斗式提升机', tag: 'E-101', left: 320, top: MAIN_LINE_Y },
    { id: 'vf', kind: 'vibFeeder', name: '振动喂料器', tag: 'VF-201', left: 480, top: MAIN_LINE_Y },
    { id: 'cs', kind: 'colorSorter', name: '色选机', tag: 'CS-201', left: 640, top: MAIN_LINE_Y },
    { id: 'pbin', kind: 'productBin', name: '成品斗', tag: 'B-301', left: 820, top: MAIN_LINE_Y },
    { id: 'pk', kind: 'packingScale', name: '包装秤', tag: 'PK-401', left: 980, top: MAIN_LINE_Y },
    { id: 'out', kind: 'outlet', name: '成品出库', tag: 'OUT', left: 1140, top: MAIN_LINE_Y },
    // ---- 副品带 ----
    { id: 'rb', kind: 'rejectBin', name: '副品斗', tag: 'B-302', left: 500, top: REJECT_Y },
    { id: 'rj', kind: 'rejectOut', name: '副品外售', tag: 'RJ', left: 720, top: REJECT_Y },
    // ---- 气源 / 除尘带 ----
    { id: 'ac', kind: 'airCompressor', name: '空压机', tag: 'AC-501', left: 0, top: UTILITY_Y },
    { id: 'dc', kind: 'dustCollector', name: '布袋除尘器', tag: 'DC-601', left: 1000, top: UTILITY_Y },
  ],
  pipes: [
    // ---- 主米流（7）----
    { id: 'p-in-raw', sourceId: 'in', targetId: 'raw', medium: 'grain', dn: 'φ219' },
    { id: 'p-raw-ele', sourceId: 'raw', targetId: 'ele', medium: 'grain', dn: 'φ219' },
    { id: 'p-ele-vf', sourceId: 'ele', targetId: 'vf', medium: 'grain', dn: 'φ159' },
    { id: 'p-vf-cs', sourceId: 'vf', targetId: 'cs', medium: 'grain', dn: 'φ159' },
    { id: 'p-cs-pbin', sourceId: 'cs', targetId: 'pbin', medium: 'grain', dn: 'φ159' },
    { id: 'p-pbin-pk', sourceId: 'pbin', targetId: 'pk', medium: 'grain', dn: 'φ159' },
    { id: 'p-pk-out', sourceId: 'pk', targetId: 'out', medium: 'grain', dn: 'φ159' },
    // ---- 副品（3）：外售 + 回机复选 ----
    { id: 'p-cs-rb', sourceId: 'cs', targetId: 'rb', medium: 'reject' },
    { id: 'p-rb-rj', sourceId: 'rb', targetId: 'rj', medium: 'reject' },
    { id: 'p-rb-cs', sourceId: 'rb', targetId: 'cs', medium: 'recycle', dn: 'φ159' },
    // ---- 气源（3）：色选机喷阀 / 包装秤气动夹袋 / 除尘器脉冲清灰 ----
    { id: 'p-ac-cs', sourceId: 'ac', targetId: 'cs', medium: 'compressedAir' },
    { id: 'p-ac-pk', sourceId: 'ac', targetId: 'pk', medium: 'compressedAir' },
    { id: 'p-ac-dc', sourceId: 'ac', targetId: 'dc', medium: 'compressedAir' },
    // ---- 除尘（5）：五个扬尘点的集尘支管 ----
    { id: 'p-raw-dc', sourceId: 'raw', targetId: 'dc', medium: 'dustAir' },
    { id: 'p-ele-dc', sourceId: 'ele', targetId: 'dc', medium: 'dustAir' },
    { id: 'p-vf-dc', sourceId: 'vf', targetId: 'dc', medium: 'dustAir' },
    { id: 'p-cs-dc', sourceId: 'cs', targetId: 'dc', medium: 'dustAir' },
    { id: 'p-pbin-dc', sourceId: 'pbin', targetId: 'dc', medium: 'dustAir' },
  ],
};

/** 把最小示例建到设计器里（示例页 / 单测共用的入口） */
export function buildColorSorterDemo(designer: ColorSorterDesigner): { units: number; pipes: number } {
  return designer.mount(COLOR_SORTER_DEMO_DOC);
}

export default COLOR_SORTER_DEMO_DOC;
