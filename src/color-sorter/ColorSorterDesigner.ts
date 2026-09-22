/**
 * Copyright (c) 2022 大漠穷秋.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

/**
 * 大米色选工艺流程图应用层（color-sorter 域）。
 *
 * 与给水排水包（`WaterProcessDesigner`）同一条骨架：复用流程图应用层的选择 / 增删改 / 连线 /
 * 历史 / 快照 / 导出 / 适应视图，只补这一行特有的东西：
 *
 * 1. **符号组件** `ColorSorterSymbol`：`kind-first` 架构 —— 内部形状由 `colorSorter_shapes`
 *    的 18 个画法函数派生（`hasDerivedChildren() === true`），符号本身不进文档；
 *    画法函数不写死任何色值，描边 / 字号走引擎主题（`applyDesignerChrome(ice)` 在基类构造期已应用）。
 * 2. **管线带介质与管径** `ColorSorterPipe`：大米主流 / 副品 / 复选回料 / 压缩空气 / 含尘气流 /
 *    仪表信号 / 动力回路，按介质着色与定线型 —— 色选图纸靠这个把米线、气线、除尘线、信号线分开。
 * 3. **DSL 装载** `mount(doc)`：把一份 `ColorSorterDslDocument`（units + pipes）建成图，
 *    供应用层「一张图一张表」直接调用。
 *
 * 工艺校验（四条色选特有约束）在 `validateColorSorter.ts`：它吃的是 **DSL 文档**、永不抛异常，
 * 与渲染层解耦 —— 模型可以在没有画布的情况下先判一遍。
 */
import { ICEGroup, ICEText, token } from 'ice-render';
import merge from 'lodash/merge';
import FlowDesigner from '../flow/FlowDesigner';
import FlowEdge from '../flow/FlowEdge';
import {
  COLOR_SORTER_MEDIUM_STYLES,
  COLOR_SORTER_SHAPE_PATHS,
  COLOR_SORTER_SYMBOL_PRESETS,
} from './colorSorter_shapes';
import type {
  ColorSorterDslDocument,
  ColorSorterMedium,
  ColorSorterSymbolKind,
  ColorSorterSymbolPreset,
} from './colorSorter_shapes';
import { registerIEDType } from '../utils/type-registry';

/**
 * 介质线型 → 虚线数组（点划线 = 长划 + 点）。
 *
 * 为什么不让引擎认 `'dashdot'`：`ICEPolyLine` 只把 `'dashed'` 映射成默认虚线，
 * 其它取值会被当成实线 —— 那"信号线"就与米流线画得一模一样了。
 */
export function dashPatternOf(lineType: 'solid' | 'dashed' | 'dashdot', lineWidth: number): number[] {
  const w = Math.max(1, lineWidth);
  if (lineType === 'dashed') return [w * 4, w * 4];
  if (lineType === 'dashdot') return [w * 7, w * 3, w * 1.5, w * 3];
  return [];
}

/** 管线标注：`φ219 大米主流` 这种「管径 + 介质」是粮食行业图纸的通行写法 */
export function composePipeLabel(medium: ColorSorterMedium, dn: string): string {
  const style = COLOR_SORTER_MEDIUM_STYLES[medium] || COLOR_SORTER_MEDIUM_STYLES.grain;
  const size = String(dn || '').trim();
  return size ? `${size} ${style.label}` : style.label;
}

/**
 * @class ColorSorterSymbol 色选工艺图图元（复合组件）
 *
 * `kind-first`：内部形状与文字按 `kind` 派生（`hasDerivedChildren() === true`），
 * 不进文档、载入时按 state 重建；`getSerializableChildren()` 声明真实子节点（本包没有，保留钩子）。
 */
export class ColorSorterSymbol extends ICEGroup {
  /** 稳定的类型标识（判型与序列化都用它，不要用类名） */
  public static readonly typeId = 'ice-entity-designer:ColorSorterSymbol';

  /** 派生部件（形状 / 文字），测试与属性面板可以按角色取用 */
  public parts: Array<{ role: string; component: any }> = [];

  public hasDerivedChildren(): boolean {
    return true;
  }

  public getSerializableChildren(): any[] {
    const derived = this.parts.map((item) => item.component);
    return this.childNodes.filter((child: any) => derived.indexOf(child) === -1);
  }

  constructor(props: any = {}) {
    super(ColorSorterSymbol.arrangeParam(props));
    this.syncShape();
  }

  protected static arrangeParam(props: any = {}) {
    const kind: ColorSorterSymbolKind = (props.kind || 'colorSorter') as ColorSorterSymbolKind;
    const preset = COLOR_SORTER_SYMBOL_PRESETS[kind] || COLOR_SORTER_SYMBOL_PRESETS.colorSorter;
    return merge(
      {
        kind,
        /** 位号（画在符号上方，如 `CS-201`） */
        tag: preset.tag,
        /** 设备 / 单元名称（画在符号下方） */
        name: '',
        // 自身不画：轮廓一律由派生形状绘制
        fill: false,
        stroke: false,
        width: preset.width,
        height: preset.height,
        /**
         * **不可变换**（只能拖动）：符号的比例与朝向是记法的一部分。
         * 图纸整体缩放走视图缩放（滚轮 / ICE.zoomAt）。
         */
        transformable: false,
      },
      props
    );
  }

  private static readonly __shapeKeys = ['kind', 'tag', 'name', 'width', 'height'];

  public setState(patch: any): void {
    const needsSync =
      !!patch && ColorSorterSymbol.__shapeKeys.some((key) => Object.prototype.hasOwnProperty.call(patch, key));
    super.setState(patch);
    if (needsSync) {
      this.syncShape();
    }
  }

  public applyPatch(patch: any = {}): void {
    this.setState(patch);
  }

  /** 取某个角色的派生部件（测试 / 属性面板用） */
  public part(role: string): any {
    const hit = this.parts.find((item) => item.role === role);
    return hit ? hit.component : null;
  }

  /** 按 `kind` 重建内部形状与文字 */
  protected syncShape(): void {
    this.__clearParts();
    const kind: ColorSorterSymbolKind = (this.state.kind || 'colorSorter') as ColorSorterSymbolKind;
    const preset = COLOR_SORTER_SYMBOL_PRESETS[kind] || COLOR_SORTER_SYMBOL_PRESETS.colorSorter;
    const w = this.state.width || preset.width;
    const h = this.state.height || preset.height;
    // 未知 kind 落到色选机画法（渲染层不抛：诊断交给 validateColorSorter）
    const shapeFn = COLOR_SORTER_SHAPE_PATHS[kind] || COLOR_SORTER_SHAPE_PATHS.colorSorter;
    const shape: ColorSorterSymbolPreset = { ...preset, width: w, height: h };
    this.__add('shape', shapeFn(shape));

    /**
     * 文字排版（与其它域包同口径）：**位号在上、名称在下**，都在符号边界外侧居中；
     * 图形内部只保留符号自身的构成要素。颜色走主题 token，不写死。
     */
    const labelWidth = Math.max(w + 24, 90);
    const labelLeft = w / 2 - labelWidth / 2;
    if (this.state.tag) {
      this.__addText('tag', labelLeft, -18, labelWidth, String(this.state.tag), 9.5, token('muted'));
    }
    const name = String(this.state.name || '');
    if (name) {
      this.__addText('name', labelLeft, h + 14, labelWidth, name, 12, token('text'));
    }
  }

  // ---------------- 内部 ----------------

  /**
   * 文本部件：**显式给文字盒（width/height）+ textAlign/textBaseline 居中**。
   * 不给盒、靠自己估算宽度去挪 left，实测会又偏又挤。
   *
   * `color` 收主题引用（`token('text')`）而不是色值 —— 与画法函数同一条口径，深色主题跟着换。
   */
  private __addText(
    role: string,
    boxLeft: number,
    boxTop: number,
    boxWidth: number,
    text: string,
    fontSize: number,
    color: any
  ): ICEText {
    return this.__add(
      role,
      new ICEText({
        left: boxLeft,
        top: boxTop,
        width: boxWidth,
        height: Math.round(fontSize * 1.4),
        text,
        stroke: false,
        interactive: false,
        linkable: false,
        style: { fontSize, fillStyle: color, textAlign: 'center', textBaseline: 'middle' },
      })
    );
  }

  private __add(role: string, component: any): any {
    this.addChild(component);
    this.parts.push({ role, component });
    return component;
  }

  private __clearParts(): void {
    this.parts.forEach((item) => {
      if (item.component && item.component.parentNode === this) {
        this.removeChild(item.component);
      }
    });
    this.parts = [];
  }
}

/**
 * @class ColorSorterPipe 色选工艺管线（大米主流 / 副品 / 复选回料 / 压缩空气 / 含尘气流 / 信号 / 动力）
 *
 * 一条线 = 一段管线，介质与管径写在线上；线型与颜色跟介质走。
 */
export class ColorSorterPipe extends FlowEdge {
  public static readonly typeId = 'ice-entity-designer:ColorSorterPipe';

  /** 按当前介质刷新线型、颜色与标注 */
  public applyMediumStyle(): void {
    const medium = (this.state.medium || 'grain') as ColorSorterMedium;
    const style = COLOR_SORTER_MEDIUM_STYLES[medium] || COLOR_SORTER_MEDIUM_STYLES.grain;
    const label =
      this.state.label === undefined || this.state.label === ''
        ? composePipeLabel(medium, this.state.dn)
        : this.state.label;
    this.setState({
      // 引擎（`ICEPolyLine`）只认 `solid` / `dashed` 两个值；**点划线靠 `lineDash` 表达**
      lineType: style.lineType === 'solid' ? 'solid' : 'dashed',
      lineDash: dashPatternOf(style.lineType, Number((this.state.style || {}).lineWidth) || 1.4),
      label,
      style: { ...(this.state.style || {}), strokeStyle: style.color, fillStyle: style.color },
    } as any);
  }

  /** 改介质（属性面板 / 工艺改线用） */
  public setMedium(medium: ColorSorterMedium, dn?: string): void {
    this.setState({ medium, label: '', dn: dn === undefined ? this.state.dn : dn } as any);
    this.applyMediumStyle();
  }
}

export default class ColorSorterDesigner extends FlowDesigner {
  /** 构造期传入的 DSL 文档（`mount()` 无参调用时回退到它） */
  private readonly __doc?: ColorSorterDslDocument;

  constructor(ice: any, doc?: ColorSorterDslDocument) {
    super(ice);
    registerIEDType(this.ice, ColorSorterSymbol);
    registerIEDType(this.ice, ColorSorterPipe);
    this.__doc = doc;
    if (doc) {
      this.mount(doc);
    }
  }

  /**
   * kind → 画法函数。18 种符号一一对应；未支持的 kind **抛错**（这是程序化建图的入口，
   * 写错了要立刻炸，不能静默画成别的符号）。
   */
  public static createSymbolPath(kind: ColorSorterSymbolKind): (preset: ColorSorterSymbolPreset) => ICEGroup {
    const fn = COLOR_SORTER_SHAPE_PATHS[kind as ColorSorterSymbolKind];
    if (!fn) {
      throw new Error(`unsupported color-sorter symbol kind: ${kind}`);
    }
    return fn;
  }

  public get nodes(): any[] {
    return this.__flatten().filter((item: any) => this.isNodeComponent(item));
  }

  public get edges(): any[] {
    return this.__flatten().filter((item: any) => this.isEdgeComponent(item));
  }

  /**
   * 选中判据：本包的符号不是 `FlowNode` 的分支（`ColorSorterSymbol extends ICEGroup`），
   * 所以必须把它（与管线）补进"可点选"的集合 —— 否则点符号选不中、属性面板显示不出来。
   */
  protected isSelectableComponent(component: any): boolean {
    return (
      component instanceof ColorSorterSymbol ||
      component instanceof ColorSorterPipe ||
      super.isSelectableComponent(component)
    );
  }

  protected isNodeComponent(component: any): boolean {
    return component instanceof ColorSorterSymbol;
  }

  protected isEdgeComponent(component: any): boolean {
    return component instanceof ColorSorterPipe;
  }

  /** 建一个符号（设备 / 单元 / 边界） */
  public createSymbol(kind: ColorSorterSymbolKind, props: any = {}): any {
    this.__captureHistory();
    const node = new ColorSorterSymbol({ kind, ...props });
    if (props.left === undefined || props.top === undefined) {
      const placement = this.__defaultPlacement(node.state.width, node.state.height);
      node.setState({
        left: props.left === undefined ? placement.left : props.left,
        top: props.top === undefined ? placement.top : props.top,
      });
    }
    this.ice.addChild(node);
    this.__attachNodeListeners(node);
    this.selectedId = node.state.id;
    this.__emitChange();
    return node;
  }

  /**
   * 建一段管线（要标介质）。
   *
   * 端点槽位兜底是 **R → L**（不是引擎的 `B → T`）：色选主米流从左往右走，
   * 与 DSL 的 `DEFAULT_SOURCE_PORT='R' / TARGET='L'` 同一条约定。显式传槽位仍然优先。
   */
  public createPipe(props: any = {}): any {
    const source = props.sourceId ? this.ice.findComponent(props.sourceId) : null;
    const target = props.targetId ? this.ice.findComponent(props.targetId) : null;
    if (!source || !target) {
      throw new Error('管线两端必须是已存在的符号');
    }
    this.__captureHistory();
    const sourcePort = props.sourcePort || 'R';
    const targetPort = props.targetPort || 'L';
    const pipe = new ColorSorterPipe({
      // id 由调用方决定（DSL 往返要用它引用这段管线）
      id: props.id,
      links: { start: { id: props.sourceId, position: sourcePort }, end: { id: props.targetId, position: targetPort } },
      startPoint: this.__slotPoint(source, sourcePort),
      endPoint: this.__slotPoint(target, targetPort),
      medium: props.medium || 'grain',
      dn: props.dn || '',
      label: props.label,
      arrow: props.arrow || 'end',
      linkShape: props.linkShape || 'visio',
    });
    if (props.label === undefined) {
      pipe.applyMediumStyle();
    }
    this.ice.addChild(pipe);
    this.selectedId = pipe.state.id;
    this.__emitChange();
    return pipe;
  }

  /**
   * 按 DSL 文档建图（units → 符号，pipes → 管线）。
   *
   * 缺省用构造期那份文档；文档缺字段按空数组处理，但**管线引用不存在的单元会抛错**
   * （那是坏文档，程序化建图不该静默吞掉；只判不建请走 `validateColorSorter`）。
   */
  public mount(doc: ColorSorterDslDocument = this.__doc as ColorSorterDslDocument): { units: number; pipes: number } {
    const units = doc && Array.isArray(doc.units) ? doc.units : [];
    const pipes = doc && Array.isArray(doc.pipes) ? doc.pipes : [];
    units.forEach((unit) => {
      this.createSymbol(unit.kind as ColorSorterSymbolKind, {
        id: unit.id,
        name: unit.name,
        tag: unit.tag,
        left: unit.left,
        top: unit.top,
      });
    });
    pipes.forEach((pipe) => {
      this.createPipe({
        id: pipe.id,
        sourceId: pipe.sourceId,
        targetId: pipe.targetId,
        medium: pipe.medium,
        dn: pipe.dn,
        sourcePort: pipe.sourcePort,
        targetPort: pipe.targetPort,
      });
    });
    return { units: units.length, pipes: pipes.length };
  }
}
