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
 * 引擎主题（描边色/字号）由实例 applyDesignerChrome(ice) 派生 —— 画法函数不写死
 * 任何色值（描边/填充走主题默认），唯一的色板是下面的介质表（已在取色预算棘轮登记）。
 *
 * 与 water 同一条画线口径（见 water_shapes 的 __poly / __closedPoly 注释）：
 * - 轴对齐的两点直线画成细矩形 —— 折线包围盒由点集算出，水平线高 0、垂直线宽 0，
 *   组件级离屏缓存会拿 0 尺寸画布去 drawImage 而报错；
 * - 闭合图形拆成「开放折线 + 单独一条闭合边」，不用 closePath / 首尾重复点；
 * - 轴对齐虚线用一串细矩形拼出（既要虚线外观、又要包围盒不退化）。
 */
import { ICECircle, ICEGroup, ICEPolyLine, ICERect, ICEText, token } from 'ice-render';

/** 组内坐标用数对（ICEPolyLine 的 points 口径）。 */
type Pt = [number, number];

/** 细矩形线段的厚度（与引擎默认 lineWidth 一致）。 */
const LINE_WIDTH = 1;

/** 线色：与主题默认 strokeStyle（semantic.border）同一路径，paint 时解析。 */
const lineColor = () => token('border');

/** 空组：自身不画（轮廓一律由子件绘制）。 */
function newGroup(): ICEGroup {
  return new ICEGroup({ fill: false, stroke: false });
}

/** 空心矩形（描边走主题默认；radius 为圆角）。 */
function addRect(group: ICEGroup, left: number, top: number, width: number, height: number, radius = 0): ICERect {
  const rect = new ICERect({ left, top, width, height, radius, fill: false, interactive: false, linkable: false });
  group.addChild(rect);
  return rect;
}

/** 空心圆（ICECircle 的位置参数是外接盒左上角 left/top，这里按圆心收参）。 */
function addCircle(group: ICEGroup, cx: number, cy: number, r: number): ICECircle {
  const circle = new ICECircle({
    left: cx - r,
    top: cy - r,
    radius: r,
    fill: false,
    interactive: false,
    linkable: false,
  });
  group.addChild(circle);
  return circle;
}

/** 一段填充细矩形（轴对齐线段 / 虚线段落的落点）。 */
function addThinRect(group: ICEGroup, left: number, top: number, width: number, height: number): void {
  const color = lineColor();
  group.addChild(
    new ICERect({
      left,
      top,
      width,
      height,
      interactive: false,
      linkable: false,
      style: { fillStyle: color, strokeStyle: color, lineWidth: 0 },
    })
  );
}

/**
 * 折线。两点且某一维轴对齐退化的，画成细矩形（渲染结果一致、包围盒不退化，与 water 同口径）；
 * 轴对齐虚线用一串细矩形拼出（ICEPolyLine 的虚线会让包围盒退化，矩形拼的不会）。
 */
function addLine(group: ICEGroup, pts: Pt[], dashed = false): void {
  const degenerate =
    pts.length === 2 && (Math.abs(pts[1][0] - pts[0][0]) < 0.01 || Math.abs(pts[1][1] - pts[0][1]) < 0.01);
  if (degenerate) {
    const [ax, ay] = pts[0];
    const [bx, by] = pts[1];
    const horizontal = Math.abs(ay - by) < 0.01;
    const len = horizontal ? Math.abs(bx - ax) : Math.abs(by - ay);
    if (!dashed) {
      const left = horizontal ? Math.min(ax, bx) : Math.min(ax, bx) - LINE_WIDTH / 2;
      const top = horizontal ? Math.min(ay, by) - LINE_WIDTH / 2 : Math.min(ay, by);
      addThinRect(group, left, top, horizontal ? len : LINE_WIDTH, horizontal ? LINE_WIDTH : len);
      return;
    }
    // 虚线：dash 4 / gap 3 的细矩形串
    const dir = (horizontal ? bx - ax : by - ay) >= 0 ? 1 : -1;
    for (let d = 0; d < len; d += 7) {
      const seg = Math.min(4, len - d);
      const left = horizontal ? ax + dir * d : ax - LINE_WIDTH / 2;
      const top = horizontal ? ay - LINE_WIDTH / 2 : ay + dir * d;
      addThinRect(group, left, top, horizontal ? seg : LINE_WIDTH, horizontal ? LINE_WIDTH : seg);
    }
    return;
  }
  group.addChild(
    new ICEPolyLine({
      points: pts,
      lineType: dashed ? 'dashed' : 'solid',
      arrow: 'none',
      interactive: false,
      linkable: false,
    } as any)
  );
}

/** 闭合图形：先画开放折线，再单独补一条闭合边（与 water 的 __closedPoly 同口径）。 */
function addClosed(group: ICEGroup, pts: Pt[], dashed = false): void {
  addLine(group, pts, dashed);
  addLine(group, [pts[pts.length - 1], pts[0]], dashed);
}

/** 文本部件：显式文字盒 + textAlign/textBaseline（与 water 的 __text 同口径）。 */
function addText(group: ICEGroup, left: number, top: number, width: number, text: string, fontSize: number): ICEText {
  const node = new ICEText({
    left,
    top,
    width,
    height: Math.round(fontSize * 1.4),
    text,
    stroke: false,
    interactive: false,
    linkable: false,
    style: { fontSize, textAlign: 'left', textBaseline: 'middle' },
  });
  group.addChild(node);
  return node;
}

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

/**
 * 仓斗统一画法：筒身 + 倒锥斗底 + 顶进料口。
 * @param width  整体宽
 * @param height 整体高（含顶部进料口 6px）
 * @param hasInletTop  顶部进料口（原料仓/缓冲斗有；成品斗/副品斗的入料多在侧面）
 */
function binShape(width: number, height: number, hasInletTop: boolean): ICEGroup {
  const bodyTop = hasInletTop ? 6 : 0;
  const bodyH = height - bodyTop - (height - bodyTop) * 0.42;
  const group = newGroup();
  if (hasInletTop) {
    addRect(group, (width - 24) / 2, 0, 24, 6, 2);
  }
  addRect(group, 0, bodyTop, width, bodyH);
  // 倒锥斗底
  addClosed(group, [
    [0, bodyTop + bodyH],
    [width / 2, height],
    [width, bodyTop + bodyH],
  ]);
  // 出料口小段
  addLine(group, [
    [width / 2, height],
    [width / 2, height + 6],
  ]);
  return group;
}

export function rawBinShape(p: ColorSorterSymbolPreset): ICEGroup {
  return binShape(p.width, p.height, true);
}
export function bufferBinShape(p: ColorSorterSymbolPreset): ICEGroup {
  return binShape(p.width, p.height, true);
}
export function productBinShape(p: ColorSorterSymbolPreset): ICEGroup {
  return binShape(p.width, p.height, false);
}
export function rejectBinShape(p: ColorSorterSymbolPreset): ICEGroup {
  return binShape(p.width, p.height, false);
}

/**
 * 斗式提升机：竖机筒 + 畚斗带（双虚线表示）+ 机头 + 出料弯。
 */
export function elevatorShape(p: ColorSorterSymbolPreset): ICEGroup {
  const { width: w, height: h } = p;
  const group = newGroup();
  // 机筒
  addRect(group, (w - 22) / 2, 14, 22, h - 24);
  // 畚斗带（两条虚线）
  addLine(
    group,
    [
      [(w - 22) / 2 + 6, 18],
      [(w - 22) / 2 + 6, h - 12],
    ],
    true
  );
  addLine(
    group,
    [
      [(w - 22) / 2 + 16, 18],
      [(w - 22) / 2 + 16, h - 12],
    ],
    true
  );
  // 机头
  addRect(group, (w - 30) / 2, 2, 30, 14);
  // 出料弯
  addLine(group, [
    [(w + 22) / 2, 6],
    [w - 4, 6],
    [w - 4, 20],
    [w + 4, 20],
  ]);
  return group;
}

/**
 * 振动喂料器：料槽（梯形）+ 振动波线 + 下方虚线表示下料。
 */
export function vibFeederShape(p: ColorSorterSymbolPreset): ICEGroup {
  const { width: w, height: h } = p;
  const group = newGroup();
  // 料槽梯形
  addClosed(group, [
    [0, 6],
    [w - 14, 6],
    [w, h - 6],
    [14, h - 6],
  ]);
  // 振动波线（右外）
  for (let i = 0; i < 3; i++) {
    const cx = w + 10;
    const cy = 14 + i * 12;
    addLine(group, [
      [cx, cy],
      [cx + 5, cy - 6],
      [cx + 10, cy],
    ]);
  }
  return group;
}

/**
 * 色选机主机：立柜 + 滑槽（斜线）+ 相机（带十字圆）+ 喷阀排 + 底部正品/副品双出料口。
 * 这个符号是整个色选域包的辨识核心——观众一眼看出"这里在做色选"。
 */
export function colorSorterShape(p: ColorSorterSymbolPreset): ICEGroup {
  const { width: w, height: h } = p;
  const group = newGroup();
  // 立柜外框
  addRect(group, 12, 0, w - 24, h);
  // 顶部进料口
  addLine(group, [
    [w / 2 - 8, 8],
    [w / 2 - 8, 24],
    [w / 2 + 8, 24],
    [w / 2 + 8, 8],
  ]);
  // 滑槽（斜线，从顶进料口到中部）
  addLine(group, [
    [w / 2 - 8, 24],
    [w / 2 + 18, 56],
  ]);
  // 相机（带十字圆）
  addCircle(group, w / 2 + 24, 50, 5);
  addLine(group, [
    [w / 2 + 24, 45],
    [w / 2 + 24, 55],
  ]);
  addLine(group, [
    [w / 2 + 19, 50],
    [w / 2 + 29, 50],
  ]);
  // 喷阀排（底部三个短竖线）
  for (let i = 0; i < 3; i++) {
    addLine(group, [
      [w / 2 - 10 + i * 10, h - 28],
      [w / 2 - 10 + i * 10, h - 18],
    ]);
  }
  // 底部双出料口（正品左、副品右）
  addLine(group, [
    [w / 2 - 12, h - 4],
    [w / 2 - 4, h - 14],
    [w / 2 - 4, h - 4],
  ]);
  addLine(group, [
    [w / 2 + 4, h - 14],
    [w / 2 + 4, h - 4],
    [w / 2 + 12, h - 4],
  ]);
  return group;
}

export function isColorSorterSymbolKind(kind: string): kind is ColorSorterSymbolKind {
  return (COLOR_SORTER_SYMBOL_KINDS as readonly string[]).indexOf(kind) !== -1;
}

export function isColorSorterMedium(m: string): m is ColorSorterMedium {
  return m in COLOR_SORTER_MEDIUM_STYLES;
}
