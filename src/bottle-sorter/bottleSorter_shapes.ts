/**
 * Copyright (c) 2022 大漠穷秋.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

/**
 * 整瓶分选工艺图符号库（bottle-sorter 域）。
 *
 * 与色选域包（`color-sorter`）是**两个域**：那张图讲的是"一颗米从进厂到装袋"，
 * 这张讲的是"一只塑料瓶从打包到分色"（拆包 → 滚筒筛 → 逐级 AI 整瓶分选 → 分色仓称重）。
 * 两者的符号、介质、工艺约束都不一样，所以按 kind 分家，而不是往色选包里堆——
 * 堆在一起的话色选那套工艺约束（色选机必须接气源……）会误判整瓶图。
 *
 * ## 记法与外观
 *
 * 记法依据：塑料回收 / 再生 PET 行业通行的工艺流程图画法（无强制性国标图例），
 * 与色选域包同一条铁律 —— **全部符号共用一套描边色、线宽与基准尺寸，画法函数不写死任何色值**
 * （描边走主题 token `border`，深色主题跟着换）。分色靠**符号内部的记法要素**表达，
 * 不靠色块：高光谱机画光谱条纹、紫外机画 UV 灯管、AI 整瓶机画相机 + 喷阀、
 * 脱标机画剥离弧 —— 黑白打印出来一样分得清。
 *
 * 与 `color-sorter` 共用同一套画线口径（轴对齐两点画细矩形 / 闭合图形拆成开放折线 + 闭合边），
 * 理由见那边文件头的注释：折线包围盒由点集算出，水平线高 0、垂直线宽 0，
 * 组件级离屏缓存会拿 0 尺寸画布去 drawImage 而报错。
 */
import { ICECircle, ICEGroup, ICEPolyLine, ICERect, ICEText, token } from 'ice-render';

/** 组内坐标用数对（ICEPolyLine 的 points 口径）。 */
type Pt = [number, number];

/** 细矩形线段的厚度（与引擎默认 lineWidth 一致）。 */
const LINE_WIDTH = 1;

/** 线色：与主题默认 strokeStyle（semantic.border）同一路径，paint 时解析。 */
const lineColor = () => token('border');

/**
 * 空组：自身不画（轮廓一律由子件绘制）。
 *
 * **必须标 `linkable: false` + `interactive: false`**（与色选域包同一条坑）：
 * 引擎的 `ICELinkSlotManager` 会拉平整棵树去找 `linkable` 组件，
 * 漏标的话拖连线时插槽会吸附到这层"形状容器"上，而不是符号本体。
 */
function newGroup(): ICEGroup {
  return new ICEGroup({ fill: false, stroke: false, interactive: false, linkable: false });
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
 * 折线。两点且某一维轴对齐退化的，画成细矩形（渲染结果一致、包围盒不退化，与色选同口径）；
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

/** 闭合图形：先画开放折线，再单独补一条闭合边（与色选 / 给排水同口径）。 */
function addClosed(group: ICEGroup, pts: Pt[], dashed = false): void {
  addLine(group, pts, dashed);
  addLine(group, [pts[pts.length - 1], pts[0]], dashed);
}

/** 文本部件：显式文字盒 + textAlign/textBaseline（与色选 / 给排水同口径）。 */
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

/**
 * 八角缺角矩形（参考图里那排"整瓶机"的外形）。
 *
 * 缺角不是为了好看：它让**分选机**在一张满是方块 / 圆筒的图上立刻认出来 ——
 * 与色选图的"色选机"用圆角矩形是同一个目的（形状即类别）。
 */
function addNotchedBox(group: ICEGroup, w: number, h: number, cut = 10): void {
  addClosed(group, [
    [cut, 0],
    [w - cut, 0],
    [w, cut],
    [w, h - cut],
    [w - cut, h],
    [cut, h],
    [0, h - cut],
    [0, cut],
  ]);
}

export const BOTTLE_SORTER_SYMBOL_KINDS = [
  // ---- 上料段：来料 → 拆包 → 筛分 ----
  'inlet',
  'bagOpener',
  'drumScreen',
  // ---- 分选设备（逐级缩窄目标物料）----
  'bottleSorter',
  'labelRemover',
  'spectralSorter',
  'uvSorter',
  // ---- 成品 / 副品接收：分色仓 + 称重 ----
  'bottleBin',
  'bottleScale',
] as const;

export type BottleSorterSymbolKind = (typeof BOTTLE_SORTER_SYMBOL_KINDS)[number];

export const BOTTLE_SORTER_MEDIUM_STYLES: Record<
  BottleSorterMedium,
  { label: string; color: string; lineType: 'solid' | 'dashed' | 'dashdot' }
> = {
  bottle: { label: '整瓶流', color: '#1d4ed8', lineType: 'solid' },
  recycle: { label: '复选回料', color: '#0d9488', lineType: 'solid' },
  reject: { label: '剔除物', color: '#b45309', lineType: 'solid' },
};

export type BottleSorterMedium = 'bottle' | 'recycle' | 'reject';

export interface BottleSorterSymbolPreset {
  label: string;
  tag: string;
  width: number;
  height: number;
  shape: 'tank' | 'round' | 'device' | 'boundary';
  inline: boolean;
}

export const BOTTLE_SORTER_SYMBOL_PRESETS: Record<BottleSorterSymbolKind, BottleSorterSymbolPreset> = {
  inlet: { label: '来料', tag: 'IN', width: 100, height: 36, shape: 'boundary', inline: false },
  bagOpener: { label: '拆包机', tag: 'BO', width: 92, height: 62, shape: 'device', inline: false },
  drumScreen: { label: '滚筒筛', tag: 'TS', width: 84, height: 84, shape: 'round', inline: false },
  bottleSorter: { label: 'AI整瓶机', tag: 'AI', width: 108, height: 66, shape: 'device', inline: false },
  labelRemover: { label: '脱标机', tag: 'LR', width: 78, height: 78, shape: 'round', inline: false },
  spectralSorter: { label: '高光谱AI整瓶机', tag: 'HS', width: 112, height: 70, shape: 'device', inline: false },
  uvSorter: { label: '紫外AI整瓶机', tag: 'UV', width: 104, height: 70, shape: 'device', inline: false },
  bottleBin: { label: '分色瓶仓', tag: 'B', width: 86, height: 88, shape: 'tank', inline: false },
  bottleScale: { label: '称重秤', tag: 'W', width: 92, height: 40, shape: 'device', inline: false },
};

/**
 * 拆包机：机壳 + 顶部进料口 + 横向拆包刀 + 底部出料口。
 *
 * 打捆瓶进线的第一道工序 —— 把打包带 / 缠绕膜破开，后面的滚筒筛才吃得进去。
 * 横贯机身的**刀线**是这个符号的辨识特征。
 */
export function bagOpenerShape(p: BottleSorterSymbolPreset): ICEGroup {
  const { width: w, height: h } = p;
  const group = newGroup();
  addNotchedBox(group, w, h, 8);
  // 顶部进料口
  addLine(group, [
    [w / 2 - 12, 0],
    [w / 2 - 12, -6],
  ]);
  addLine(group, [
    [w / 2 + 12, 0],
    [w / 2 + 12, -6],
  ]);
  // 拆包刀（横贯的锯齿线）
  addLine(group, [
    [10, h * 0.46],
    [w - 10, h * 0.46],
  ]);
  for (let i = 0; i < 5; i++) {
    const x = 16 + i * ((w - 32) / 4);
    addLine(group, [
      [x, h * 0.46],
      [x + 5, h * 0.3],
    ]);
  }
  // 底部出料口
  addLine(group, [
    [w - 30, h],
    [w - 30, h + 6],
  ]);
  return group;
}

/**
 * 滚筒筛：外筒 + 内筒（双层圆） + 筒内斜筛条 + 底部出料口。
 *
 * 双层圆是回转设备的通行画法（与脱标机同形但内部不同）：筒内那几条**斜线**就是筛条，
 * 破包后的碎膜、砂石从这里筛下去。
 */
export function drumScreenShape(p: BottleSorterSymbolPreset): ICEGroup {
  const { width: w, height: h } = p;
  const group = newGroup();
  const cx = w / 2;
  const cy = h / 2;
  addCircle(group, cx, cy, Math.min(w, h) / 2 - 2);
  addCircle(group, cx, cy, Math.min(w, h) / 2 - 12);
  // 筒内斜筛条
  for (let i = -1; i <= 1; i++) {
    const dx = i * 14;
    addLine(group, [
      [cx + dx - 8, cy + 16],
      [cx + dx + 8, cy - 16],
    ]);
  }
  // 底部出料口
  addLine(group, [
    [cx, cy + Math.min(w, h) / 2 - 2],
    [cx, cy + Math.min(w, h) / 2 + 6],
  ]);
  return group;
}

/**
 * AI 整瓶机：缺角机身 + 相机视场（左上斜线 + 感光器）+ 喷阀排（右侧一排短竖线）。
 *
 * "相机看到 → 喷阀吹掉"是整瓶分选机的两件事，符号把这两件事都画出来 ——
 * 只画一个方框的话，它跟拆包机、称重秤在图上看不出区别。
 */
export function bottleSorterShape(p: BottleSorterSymbolPreset): ICEGroup {
  const { width: w, height: h } = p;
  const group = newGroup();
  addNotchedBox(group, w, h, 12);
  // 相机本体 + 视场
  addRect(group, 12, 10, 20, 14);
  addLine(group, [
    [32, 17],
    [58, 30],
  ]);
  addLine(group, [
    [32, 17],
    [58, 6],
  ]);
  // 喷阀排
  for (let i = 0; i < 4; i++) {
    const x = w - 40 + i * 9;
    addLine(group, [
      [x, h - 20],
      [x, h - 10],
    ]);
  }
  addLine(group, [
    [w - 44, h - 20],
    [w - 12, h - 20],
  ]);
  return group;
}

/**
 * 脱标机：外筒 + 内筒 + 筒内刮刀齿（左半圈一排短线）+ 右侧被刮下来的标签 + 排标口。
 *
 * 脱标是"整瓶分选"独有的工序（色选图里没有）：瓶身标签不脱掉，后面的光谱识别会被标签干扰。
 * ⚠️ 内筒里原来画的是一段**居中**的弧 —— 渲染出来像个笑脸（实测第一版就是这样），
 * 现在改成"左半圈刮刀齿 + 右侧一小片标签从排标口甩出去"，一眼能读出它在干什么。
 */
export function labelRemoverShape(p: BottleSorterSymbolPreset): ICEGroup {
  const { width: w, height: h } = p;
  const group = newGroup();
  const cx = w / 2;
  const cy = h / 2;
  const r = Math.min(w, h) / 2 - 2;
  addCircle(group, cx, cy, r);
  addCircle(group, cx, cy, r - 10);
  // 刮刀齿（内筒左侧一排短横线）
  for (let i = 0; i < 4; i++) {
    const y = cy - 18 + i * 12;
    addLine(group, [
      [cx - r + 7, y],
      [cx - r + 21, y],
    ]);
  }
  // 被刮下来的标签（内筒右侧贴着的一小片）
  addRect(group, cx + r - 34, cy - 7, 12, 14);
  // 排标口（从内筒经外筒往外的一条短线）
  addLine(group, [
    [cx + r - 8, cy],
    [cx + r + 4, cy],
  ]);
  return group;
}

/**
 * 高光谱 AI 整瓶机：缺角机身 + 光谱条纹（高低不一的竖条）+ 相机视场。
 *
 * 高光谱按**材质光谱**分选（PET / PE / PP 各一条特征谱），所以画成一组高低条纹 ——
 * 与 `bottleSorter` 的相机 + 喷阀、`uvSorter` 的灯管三者一眼可分。
 */
export function spectralSorterShape(p: BottleSorterSymbolPreset): ICEGroup {
  const { width: w, height: h } = p;
  const group = newGroup();
  addNotchedBox(group, w, h, 12);
  // 相机本体
  addRect(group, 10, 8, 18, 12);
  // 光谱条纹
  const base = h - 14;
  const heights = [16, 26, 20, 32, 22];
  heights.forEach((hh, i) => {
    const x = 36 + i * 11;
    addLine(group, [
      [x, base],
      [x, base - hh],
    ]);
  });
  // 出料口
  addLine(group, [
    [w - 26, h],
    [w - 26, h + 6],
  ]);
  return group;
}

/**
 * 紫外 AI 整瓶机：缺角机身 + UV 灯管（横管 + 上下射线）。
 *
 * 紫外用于**老化 / 泛黄**瓶的识别（老化瓶在 UV 下荧光特征不同），
 * 灯管 + 射线是这个符号专用件；它在图上总出现在"绿瓶分选"的入口，
 * 因为老化瓶要先被踢出去，才不会混进纯绿仓。
 */
export function uvSorterShape(p: BottleSorterSymbolPreset): ICEGroup {
  const { width: w, height: h } = p;
  const group = newGroup();
  addNotchedBox(group, w, h, 12);
  // UV 灯管
  addLine(group, [
    [16, h * 0.42],
    [w - 16, h * 0.42],
  ]);
  // 射线
  for (let i = 0; i < 4; i++) {
    const x = 24 + i * ((w - 48) / 3);
    addLine(group, [
      [x, h * 0.42],
      [x, h * 0.42 + 12],
    ]);
  }
  addText(group, w / 2 - 10, h * 0.42 + 16, 20, 'UV', 9);
  return group;
}

/**
 * 分色瓶仓（3A / 蓝白 / 纯绿 / 杂塑 / 瓷白 / 白瓶 / 杂质共用一种符号，靠 `name` 区分）：
 * 上部方仓 + 下部倒锥斗 + 斗口。
 *
 * 为什么七种仓共用一种 kind：工艺图里"哪只仓装什么"由**名称**决定，
 * 仓本身是同一种设备 —— 给每种颜色各造一个 kind 只会让白名单虚胖，
 * 而模型写 `kind: 'bin3a'` / `kind: 'binGreen'` 时还得背一张枚举表。
 */
export function bottleBinShape(p: BottleSorterSymbolPreset): ICEGroup {
  const { width: w, height: h } = p;
  const group = newGroup();
  const bodyH = h * 0.62;
  addRect(group, 0, 0, w, bodyH);
  addClosed(group, [
    [0, bodyH],
    [w / 2, h],
    [w, bodyH],
  ]);
  // 斗口
  addLine(group, [
    [w / 2, h],
    [w / 2, h + 6],
  ]);
  return group;
}

/**
 * 称重秤：秤台（上宽下窄的梯形）+ 底座 + 四个支脚。
 *
 * 参考图里每只仓下面都挂一台秤（仓是**容器**，秤才是**计量点**），
 * 所以它必须与仓画得完全不像：仓是"上宽下尖的斗"，秤是"上宽下窄的台"。
 */
export function bottleScaleShape(p: BottleSorterSymbolPreset): ICEGroup {
  const { width: w, height: h } = p;
  const group = newGroup();
  addClosed(group, [
    [0, 0],
    [w, 0],
    [w - 12, h],
    [12, h],
  ]);
  // 表盘
  addCircle(group, w / 2, h * 0.5, Math.min(8, h * 0.28));
  // 支脚
  addLine(group, [
    [16, h],
    [16, h + 4],
  ]);
  addLine(group, [
    [w - 16, h],
    [w - 16, h + 4],
  ]);
  return group;
}

/**
 * 边界统一画法：旗形牌 + 右侧三角箭头（表示方向）+ 文字。
 *
 * 与色选域包的 `boundaryShape` 同形同尺寸 —— 两张图挂在同一个控制台里，
 * 边界旗牌长得不一样会让人以为是两种东西。
 */
function boundaryShape(label: string): ICEGroup {
  const group = newGroup();
  addRect(group, 0, 0, 86, 36);
  addClosed(group, [
    [86, 0],
    [100, 18],
    [86, 36],
  ]);
  addText(group, 8, 12, 78, label, 11);
  return group;
}
export function inletShape(_p: BottleSorterSymbolPreset): ICEGroup {
  return boundaryShape('整瓶来料 IN');
}

export function isBottleSorterSymbolKind(kind: string): kind is BottleSorterSymbolKind {
  return (BOTTLE_SORTER_SYMBOL_KINDS as readonly string[]).indexOf(kind) !== -1;
}

export function isBottleSorterMedium(m: string): m is BottleSorterMedium {
  return m in BOTTLE_SORTER_MEDIUM_STYLES;
}

/**
 * kind → 画法函数。**单一来源**：符号组件（`BottleSorterSymbol.syncShape`）与设计器的
 * `createSymbolPath` 都走这张表，避免两处各写一个 switch 后走岔。
 */
export const BOTTLE_SORTER_SHAPE_PATHS: Record<BottleSorterSymbolKind, (preset: BottleSorterSymbolPreset) => ICEGroup> =
  {
    inlet: inletShape,
    bagOpener: bagOpenerShape,
    drumScreen: drumScreenShape,
    bottleSorter: bottleSorterShape,
    labelRemover: labelRemoverShape,
    spectralSorter: spectralSorterShape,
    uvSorter: uvSorterShape,
    bottleBin: bottleBinShape,
    bottleScale: bottleScaleShape,
  };

/** 连线槽位（与引擎 `FlowPort` 同口径） */
export type BottleSorterDslPort = 'T' | 'R' | 'B' | 'L' | 'C';

export interface BottleSorterDslUnit {
  /** 必填且在一份文档里唯一（管线的 `sourceId` / `targetId` 引用它） */
  id: string;
  /** 符号种类，取值见 `BOTTLE_SORTER_SYMBOL_KINDS`（9 种） */
  kind: string;
  /** 中文名（画在符号下方） */
  name?: string;
  /** 位号（画在符号上方，如 `AI-101`） */
  tag?: string;
  /** 画布坐标（绝对坐标）。不写时由渲染端做确定性自动排版 */
  left: number;
  top: number;
}

export interface BottleSorterDslPipe {
  id: string;
  sourceId: string;
  targetId: string;
  /** 介质，取值见 `BOTTLE_SORTER_MEDIUM_STYLES`（3 种） */
  medium: string;
  /** 管径标注；不写时线上只写介质名 */
  dn?: string;
  /**
   * **线上写什么字**（可选）。
   *
   * 色选图靠 `介质 + 管径` 组字就够（`φ219 大米主流`），而整瓶图的主流程自始至终
   * 都是同一种介质（整瓶流），区分各段的是**物料名**：`蓝/白/绿/杂`、`带标/非PET/杂色`、
   * `老化/杂色`、`杂色PET`…… 这些字不写出来，读者只看得到一根根同色的线。
   * 不写时行为与从前一致（`composePipeLabel(medium, dn)`）。
   */
  label?: string;
  sourcePort?: BottleSorterDslPort;
  targetPort?: BottleSorterDslPort;
}

/** 整瓶分选工艺流程图文档（域包侧的 kind 是 `bottle-sorter`）。 */
export interface BottleSorterDslDocument {
  kind: 'bottle-sorter';
  title?: string;
  viewport?: { focus?: string[] };
  units: BottleSorterDslUnit[];
  pipes: BottleSorterDslPipe[];
}
