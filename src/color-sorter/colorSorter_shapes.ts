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

/**
 * 空组：自身不画（轮廓一律由子件绘制）。
 *
 * **必须标 `linkable: false` + `interactive: false`**：引擎的 `ICELinkSlotManager` 会拉平整棵树去找
 * `linkable` 组件，而组件默认 `linkable: true` —— 漏标的话拖连线时插槽会吸附到这层"形状容器"上，
 * 而不是符号本体（跨包回归见 `tests/designer/derived-parts-not-linkable.test.ts`）。
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
  // ---- 主料流前段：收储与清理 / 砻谷与碾米 / 抛光（进色选之前的这几道工序）----
  'preCleaner',
  'destoner',
  'husker',
  'paddySeparator',
  'riceMill',
  'polisher',
  // ---- 主料流设备（大米线）----
  'rawBin',
  'bufferBin',
  'elevator',
  'vibFeeder',
  'colorSorter',
  'productBin',
  'rejectBin',
  'packingScale',
  // ---- 副产物接收（石子 / 稻壳 / 米糠，下层接收那条带）----
  'stoneBin',
  'huskBin',
  'branBin',
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
  preCleaner: { label: '初清筛', tag: 'SC', width: 88, height: 62, shape: 'device', inline: false },
  destoner: { label: '去石机', tag: 'DS', width: 88, height: 64, shape: 'device', inline: false },
  husker: { label: '砻谷机', tag: 'HU', width: 88, height: 72, shape: 'device', inline: false },
  paddySeparator: { label: '谷糙分离机', tag: 'PS', width: 94, height: 72, shape: 'device', inline: false },
  riceMill: { label: '碾米机', tag: 'RM', width: 90, height: 68, shape: 'device', inline: false },
  polisher: { label: '抛光机', tag: 'PL', width: 90, height: 68, shape: 'device', inline: false },
  rawBin: { label: '原料仓', tag: 'B', width: 86, height: 80, shape: 'tank', inline: false },
  bufferBin: { label: '缓冲斗', tag: 'B', width: 86, height: 68, shape: 'tank', inline: false },
  productBin: { label: '成品斗', tag: 'B', width: 86, height: 68, shape: 'tank', inline: false },
  rejectBin: { label: '副品斗', tag: 'B', width: 86, height: 52, shape: 'tank', inline: false },
  elevator: { label: '斗式提升机', tag: 'E', width: 64, height: 80, shape: 'device', inline: false },
  vibFeeder: { label: '振动喂料器', tag: 'VF', width: 84, height: 36, shape: 'device', inline: false },
  colorSorter: { label: '色选机', tag: 'CS', width: 100, height: 96, shape: 'device', inline: false },
  packingScale: { label: '包装秤', tag: 'PK', width: 86, height: 68, shape: 'device', inline: false },
  stoneBin: { label: '石子收集箱', tag: 'SB', width: 80, height: 56, shape: 'tank', inline: false },
  huskBin: { label: '稻壳收集仓', tag: 'HK', width: 86, height: 68, shape: 'tank', inline: false },
  branBin: { label: '米糠收集仓', tag: 'BR', width: 86, height: 68, shape: 'tank', inline: false },
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

/**
 * 初清筛（振动筛）：筛箱 + 倾斜筛面 + 顶部进料口，左下出轻杂、右下出净粮。
 *
 * 这是整条线的第一道工序 —— 先把秸秆、麻绳、泥块这类**大杂**筛掉，后面的砻谷、碾米
 * 才不至于被堵。斜筛面是这个符号的辨识特征（与同样带料槽的 `vibFeeder` 区别就在这里）。
 */
export function preCleanerShape(p: ColorSorterSymbolPreset): ICEGroup {
  const { width: w, height: h } = p;
  const group = newGroup();
  // 筛箱
  addRect(group, 4, 10, w - 8, h - 22);
  // 倾斜筛面（两条平行斜线 = 筛网层）
  addLine(group, [
    [10, h - 18],
    [w - 12, 16],
  ]);
  addLine(group, [
    [22, h - 14],
    [w - 6, 18],
  ]);
  // 顶部进料口
  addLine(group, [
    [w / 2 - 8, 4],
    [w / 2 - 8, 10],
  ]);
  addLine(group, [
    [w / 2 + 8, 4],
    [w / 2 + 8, 10],
  ]);
  // 轻杂出口（左下）与净粮出口（右下）
  addLine(group, [
    [14, h - 12],
    [14, h - 2],
  ]);
  addLine(group, [
    [w - 22, h - 12],
    [w - 22, h - 2],
  ]);
  return group;
}

/**
 * 去石机：吸风罩 + 机身 + 去石台面（斜线）+ 左侧石子上升路（虚线）。
 *
 * 去石靠"比重差异 + 上升气流"：石子重、沉在台面下沿被送往左侧排出，粮粒轻、被气流托着
 * 从右侧走。左侧那条**虚线**就是石子路 —— 它与实线的净粮路一起把这个符号讲清楚。
 */
export function destonerShape(p: ColorSorterSymbolPreset): ICEGroup {
  const { width: w, height: h } = p;
  const group = newGroup();
  // 吸风罩
  addRect(group, w / 2 - 14, 2, 28, 12);
  // 机身
  addRect(group, 4, 14, w - 8, h - 24);
  // 去石台面
  addLine(group, [
    [10, h - 14],
    [w - 12, 20],
  ]);
  // 石子上升路（左侧虚线）
  addLine(
    group,
    [
      [16, h - 22],
      [16, 26],
    ],
    true
  );
  // 净粮出口（右下）
  addLine(group, [
    [w - 24, h - 10],
    [w - 24, h - 2],
  ]);
  return group;
}

/**
 * 砻谷机（胶辊砻谷机）：进料斗 + 一对相向转动的胶辊 + 机壳 + 出料口。
 *
 * 一对圆辊是胶辊砻谷机的辨识特征：两辊转速不同，靠线速差把稻壳搓开（"砻谷"就是脱壳）。
 * 出料是谷糙混合物，所以它下游接的是谷糙分离机。
 */
export function huskerShape(p: ColorSorterSymbolPreset): ICEGroup {
  const { width: w, height: h } = p;
  const group = newGroup();
  // 进料斗
  addClosed(group, [
    [w / 2 - 18, 2],
    [w / 2 + 18, 2],
    [w / 2 + 8, 16],
    [w / 2 - 8, 16],
  ]);
  // 机壳
  addRect(group, 4, 16, w - 8, h - 26);
  // 一对胶辊
  addCircle(group, w / 2 - 13, 34, 10);
  addCircle(group, w / 2 + 13, 34, 10);
  // 两辊的转向标记（一条竖线穿过圆心）
  addLine(group, [
    [w / 2 - 13, 26],
    [w / 2 - 13, 42],
  ]);
  addLine(group, [
    [w / 2 + 13, 26],
    [w / 2 + 13, 42],
  ]);
  // 出料口
  addLine(group, [
    [w - 26, h - 10],
    [w - 26, h - 2],
  ]);
  return group;
}

/**
 * 谷糙分离机：多层倾斜筛体 + 左侧回砻口 + 右侧糙米口。
 *
 * 砻谷之后稻谷与糙米混在一起，靠粒度与比重差在多层筛面上分开：未脱壳的稻谷从左端
 * 回砻谷机再砻一次，糙米从右端进碾米机。**两条出料路都在符号上** —— 这正是这个符号
 * 比一个方框多出来的信息。
 */
export function paddySeparatorShape(p: ColorSorterSymbolPreset): ICEGroup {
  const { width: w, height: h } = p;
  const group = newGroup();
  // 筛体
  addRect(group, 4, 6, w - 8, h - 18);
  // 三层倾斜筛面
  for (let i = 0; i < 3; i++) {
    const y = 16 + i * 14;
    addLine(group, [
      [10, y + 10],
      [w - 12, y],
    ]);
  }
  // 回砻口（左）与糙米出口（右）
  addLine(group, [
    [4, h - 12],
    [16, h - 12],
  ]);
  addLine(group, [
    [w - 16, h - 12],
    [w - 4, h - 12],
  ]);
  return group;
}

/**
 * 碾米机（砂辊 / 铁辊）：机身 + 卧式米辊（圆）+ 上方米刀 + 进出料口。
 *
 * 卧式圆筒（米辊）是碾米机的辨识特征：糙米在辊与米刀之间被摩擦、剥掉糠层。
 * 上方的三条短竖线就是米刀。
 */
export function riceMillShape(p: ColorSorterSymbolPreset): ICEGroup {
  const { width: w, height: h } = p;
  const cy = h / 2;
  const group = newGroup();
  // 机身
  addRect(group, 6, cy - 16, w - 12, 32);
  // 卧式米辊
  addCircle(group, w / 2, cy, 12);
  addLine(group, [
    [w / 2 - 12, cy],
    [w / 2 + 12, cy],
  ]);
  // 米刀（三条短竖线）
  for (let i = 0; i < 3; i++) {
    addLine(group, [
      [w / 2 - 10 + i * 10, cy - 23],
      [w / 2 - 10 + i * 10, cy - 17],
    ]);
  }
  // 进料口（左上）与出料口（右下）
  addLine(group, [
    [10, cy - 16],
    [10, cy - 26],
  ]);
  addLine(group, [
    [w - 10, cy + 16],
    [w - 10, cy + 26],
  ]);
  return group;
}

/**
 * 抛光机：机身 + 卧式抛光筒 + 雾化喷头（三个点）+ 进出料口。
 *
 * 与碾米机的区别就在那三个点上：抛光要**加水雾**（着水抛光），靠水膜把米粒表面的
 * 糠粉与浮糠带走、提高光洁度。两个符号同为卧式圆筒，靠"有没有雾点"分开。
 */
export function polisherShape(p: ColorSorterSymbolPreset): ICEGroup {
  const { width: w, height: h } = p;
  const cy = h / 2;
  const group = newGroup();
  // 机身
  addRect(group, 6, cy - 15, w - 12, 30);
  // 卧式抛光筒
  addCircle(group, w / 2, cy, 11);
  addLine(group, [
    [w / 2 - 7, cy - 7],
    [w / 2 + 7, cy + 7],
  ]);
  // 雾化喷头（三个点）
  for (let i = 0; i < 3; i++) {
    addCircle(group, w / 2 - 10 + i * 10, cy - 22, 2);
  }
  // 进料口（左上）与出料口（右下）
  addLine(group, [
    [10, cy - 15],
    [10, cy - 25],
  ]);
  addLine(group, [
    [w - 10, cy + 15],
    [w - 10, cy + 25],
  ]);
  return group;
}

/** 仓斗**带堆积面**：仓斗 + 仓内若干条横向虚线（表示存料的高度界面）。 */
function binWithMarks(width: number, height: number, markCount: number): ICEGroup {
  const group = binShape(width, height, true);
  const bodyTop = 6;
  const bodyH = height - bodyTop - (height - bodyTop) * 0.42;
  for (let i = 0; i < markCount; i++) {
    const y = bodyTop + bodyH - 8 - i * 9;
    addLine(
      group,
      [
        [8, y],
        [width - 8, y],
      ],
      true
    );
  }
  return group;
}

/** 石子收集箱：敞口箱 + 箱内石子（三个小圆）+ 支腿。 */
export function stoneBinShape(p: ColorSorterSymbolPreset): ICEGroup {
  const { width: w, height: h } = p;
  const group = newGroup();
  // 敞口箱（上宽下窄）
  addClosed(group, [
    [4, 4],
    [w - 4, 4],
    [w - 10, h - 10],
    [10, h - 10],
  ]);
  // 石子
  addCircle(group, w / 2, h / 2, 3);
  addCircle(group, w / 2 - 13, h / 2 + 3, 3);
  addCircle(group, w / 2 + 13, h / 2 + 3, 3);
  // 支腿
  addLine(group, [
    [18, h - 10],
    [18, h - 2],
  ]);
  addLine(group, [
    [w - 18, h - 10],
    [w - 18, h - 2],
  ]);
  return group;
}

/** 稻壳收集仓：仓斗 + 仓内两条堆积面（稻壳蓬松、堆得浅）。 */
export function huskBinShape(p: ColorSorterSymbolPreset): ICEGroup {
  return binWithMarks(p.width, p.height, 2);
}

/** 米糠收集仓：仓斗 + 仓内三条堆积面（糠粉细、界面更密）。 */
export function branBinShape(p: ColorSorterSymbolPreset): ICEGroup {
  return binWithMarks(p.width, p.height, 3);
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

/**
 * 包装秤：称重斗 + 斗底锥 + 下料嘴 + 夹袋弧线。
 */
export function packingScaleShape(p: ColorSorterSymbolPreset): ICEGroup {
  const { width: w, height: h } = p;
  const group = newGroup();
  // 称重斗
  addRect(group, (w - 48) / 2, 0, 48, 22);
  addClosed(group, [
    [(w - 48) / 2, 22],
    [w / 2, 44],
    [(w + 48) / 2, 22],
  ]);
  // 下料嘴 + 夹袋弧线
  addRect(group, w / 2 - 6, 44, 12, 12);
  addLine(group, [
    [w / 2 - 14, h - 8],
    [w / 2, h - 18],
    [w / 2 + 14, h - 8],
  ]);
  return group;
}

/**
 * 空压机：主机箱 + 电机圆 + 散热片。
 */
export function airCompressorShape(p: ColorSorterSymbolPreset): ICEGroup {
  const { width: w, height: h } = p;
  const group = newGroup();
  addRect(group, 0, h / 2 - 12, w - 16, 24);
  addCircle(group, w - 8, h / 2, 12);
  // 散热片
  for (let i = 0; i < 3; i++) {
    addLine(group, [
      [6 + i * 10, h / 2 - 16],
      [6 + i * 10, h / 2 - 22],
    ]);
  }
  return group;
}

/**
 * 储气罐：立罐（圆罐身 + 上下封头）+ 顶部接管。
 */
export function airTankShape(p: ColorSorterSymbolPreset): ICEGroup {
  const { width: w, height: h } = p;
  const group = newGroup();
  const top = 6;
  const cx = w / 2;
  const bodyH = h - top;
  addRect(group, cx - w / 3, top, (2 * w) / 3, 10);
  addCircle(group, cx, top + bodyH / 2, bodyH / 2 - 6);
  addRect(group, cx - w / 3, top + bodyH - 10, (2 * w) / 3, 10);
  // 顶部接管
  addLine(group, [
    [cx, 0],
    [cx, top],
  ]);
  return group;
}

/**
 * 冷干机：机箱 + 六角雪花（制冷）。
 */
export function airDryerShape(p: ColorSorterSymbolPreset): ICEGroup {
  const { width: w, height: h } = p;
  const group = newGroup();
  addRect(group, 0, 8, w, h - 16);
  // 六角雪花
  const cx = w / 2;
  const cy = h / 2;
  const r = 14;
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3;
    addLine(group, [
      [cx, cy],
      [cx + Math.cos(a) * r, cy + Math.sin(a) * r],
    ]);
  }
  addCircle(group, cx, cy, 4);
  return group;
}

/**
 * 精密过滤器：滤芯筒 + 三级过滤芯线（虚线）+ 排水嘴。
 */
export function airFilterShape(p: ColorSorterSymbolPreset): ICEGroup {
  const { width: w, height: h } = p;
  const group = newGroup();
  addRect(group, (w - 40) / 2, 0, 40, h - 12, 8);
  // 三级过滤芯线
  for (let i = 0; i < 3; i++) {
    addLine(
      group,
      [
        [(w - 40) / 2 + 8 + i * 12, 8],
        [(w - 40) / 2 + 8 + i * 12, h - 18],
      ],
      true
    );
  }
  // 排水嘴
  addLine(group, [
    [w / 2, h - 12],
    [w / 2, h - 2],
  ]);
  addCircle(group, w / 2, h - 4, 3);
  return group;
}

/**
 * 布袋除尘器：箱体 + 竖滤袋线 + 倒锥灰斗。
 */
export function dustCollectorShape(p: ColorSorterSymbolPreset): ICEGroup {
  const { width: w, height: h } = p;
  const group = newGroup();
  const bodyH = h * 0.6;
  addRect(group, 0, 0, w, bodyH);
  // 4 条竖滤袋线
  for (let i = 0; i < 4; i++) {
    const cx = 14 + i * ((w - 28) / 3);
    addLine(group, [
      [cx, 4],
      [cx, bodyH - 4],
    ]);
  }
  // 倒锥灰斗
  addClosed(group, [
    [0, bodyH],
    [w / 2, h],
    [w, bodyH],
  ]);
  return group;
}

/**
 * 离心风机：蜗壳圆 + 切线出口。
 */
export function fanShape(p: ColorSorterSymbolPreset): ICEGroup {
  const { width: w, height: h } = p;
  const group = newGroup();
  const r = Math.min(w / 2 - 8, h / 2 - 8);
  const cx = w / 2 - 4;
  const cy = h / 2;
  addCircle(group, cx, cy, r);
  // 涡壳切线出口
  addRect(group, cx + r - 4, cy - 12, 12, 24);
  return group;
}

/**
 * 电控柜：柜体 + 门缝中线 + 显示屏 + 指示灯。
 */
export function controlCabinetShape(p: ColorSorterSymbolPreset): ICEGroup {
  const { width: w, height: h } = p;
  const group = newGroup();
  addRect(group, 0, 0, w, h);
  // 门缝中线
  addLine(group, [
    [w / 2, 0],
    [w / 2, h - 12],
  ]);
  // 显示屏
  addRect(group, 10, 8, 18, 12);
  // 指示灯
  addCircle(group, w - 12, 14, 2);
  return group;
}

/**
 * 边界统一画法：旗形牌 + 右侧三角箭头（表示方向）+ 文字，三者形状一致仅标签不同。
 */
function boundaryShape(label: string): ICEGroup {
  const group = newGroup();
  addRect(group, 0, 0, 86, 36);
  // 右侧三角箭头（表示方向）
  addClosed(group, [
    [86, 0],
    [100, 18],
    [86, 36],
  ]);
  addText(group, 8, 12, 78, label, 11);
  return group;
}
export function inletShape(_p: ColorSorterSymbolPreset): ICEGroup {
  return boundaryShape('来米 IN');
}
export function outletShape(_p: ColorSorterSymbolPreset): ICEGroup {
  return boundaryShape('成品 OUT');
}
export function rejectOutShape(_p: ColorSorterSymbolPreset): ICEGroup {
  return boundaryShape('副品外售 RJ');
}

export function isColorSorterSymbolKind(kind: string): kind is ColorSorterSymbolKind {
  return (COLOR_SORTER_SYMBOL_KINDS as readonly string[]).indexOf(kind) !== -1;
}

export function isColorSorterMedium(m: string): m is ColorSorterMedium {
  return m in COLOR_SORTER_MEDIUM_STYLES;
}

/**
 * kind → 画法函数。**单一来源**：符号组件（`ColorSorterSymbol.syncShape`）与设计器的
 * `ColorSorterDesigner.createSymbolPath` 都走这张表，避免两处各写一个 switch 后走岔。
 */
export const COLOR_SORTER_SHAPE_PATHS: Record<ColorSorterSymbolKind, (preset: ColorSorterSymbolPreset) => ICEGroup> = {
  preCleaner: preCleanerShape,
  destoner: destonerShape,
  husker: huskerShape,
  paddySeparator: paddySeparatorShape,
  riceMill: riceMillShape,
  polisher: polisherShape,
  rawBin: rawBinShape,
  bufferBin: bufferBinShape,
  productBin: productBinShape,
  rejectBin: rejectBinShape,
  elevator: elevatorShape,
  vibFeeder: vibFeederShape,
  colorSorter: colorSorterShape,
  packingScale: packingScaleShape,
  stoneBin: stoneBinShape,
  huskBin: huskBinShape,
  branBin: branBinShape,
  airCompressor: airCompressorShape,
  airTank: airTankShape,
  airDryer: airDryerShape,
  airFilter: airFilterShape,
  dustCollector: dustCollectorShape,
  fan: fanShape,
  controlCabinet: controlCabinetShape,
  inlet: inletShape,
  outlet: outletShape,
  rejectOut: rejectOutShape,
};

/** 连线槽位（与引擎 `FlowPort` 同口径） */
export type ColorSorterDslPort = 'T' | 'R' | 'B' | 'L' | 'C';

export interface ColorSorterDslUnit {
  /** 必填且在一份文档里唯一（管线的 `sourceId` / `targetId` 引用它） */
  id: string;
  /** 符号种类，取值见 `COLOR_SORTER_SYMBOL_KINDS`（27 种） */
  kind: string;
  /** 中文名（画在符号下方） */
  name?: string;
  /** 位号（画在符号上方，如 `CS-201`） */
  tag?: string;
  left: number;
  top: number;
}

export interface ColorSorterDslPipe {
  id: string;
  sourceId: string;
  targetId: string;
  /** 介质，取值见 `COLOR_SORTER_MEDIUM_STYLES`（7 种），决定颜色与线型 */
  medium: string;
  /** 管径标注（如 `φ219`）；信号线 / 动力线没有管径，留空 */
  dn?: string;
  sourcePort?: ColorSorterDslPort;
  targetPort?: ColorSorterDslPort;
}

/**
 * 色选工艺图 DSL 文档。**与 `WaterProcessDslDocument` 同形**（units + pipes + viewport）——
 * 一张图一张表的定位不变，两个域包共用同一套编译 / 校验骨架。
 */
export interface ColorSorterDslDocument {
  kind: 'color-sorter';
  /** 可选标题 */
  title?: string;
  /** 初始视图提示：要框进初始视野的单元 id；不写则用全部单元 */
  viewport?: {
    focus?: string[];
  };
  units: ColorSorterDslUnit[];
  pipes: ColorSorterDslPipe[];
}
