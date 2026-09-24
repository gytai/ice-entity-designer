/**
 * Copyright (c) 2022 大漠穷秋.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

/**
 * 整瓶分选工艺流程图应用层（bottle-sorter 域）。
 *
 * 与色选包（`ColorSorterDesigner`）同一条骨架：复用流程图应用层的选择 / 增删改 / 连线 /
 * 历史 / 快照 / 导出 / 适应视图，只补这一行特有的东西：
 *
 * 1. **符号组件** `BottleSorterSymbol`：`kind-first` —— 内部形状由 `bottleSorter_shapes`
 *    的 9 个画法函数派生（`hasDerivedChildren() === true`），符号本身不进文档；
 * 2. **管线带介质与物料名** `BottleSorterPipe`：整瓶流 / 复选回料 / 剔除物三种介质，
 *    线上还可以写一段**物料名**（`蓝/白/绿/杂` 这类）—— 整瓶图的主流程自始至终同一种介质，
 *    区分各段的是物料；
 * 3. **交叉跳线桥** `applyLinkJumps()`：横向线在交叉点拱起半圆（见 `designer/linkJumps.ts`）。
 *    交叉是"管线之间"的关系，只有拿到全图才判得出，所以由设计器统一算一次、
 *    写进每条线的 `__linkJumps`，管线在 `__calcDots()` 之后自己套用。
 * 4. **DSL 装载** `mount(doc)`：把一份 `BottleSorterDslDocument`（units + pipes）建成图。
 *
 * 工艺校验（三条整瓶特有约束）在 `validateBottleSorter.ts`：它吃的是 **DSL 文档**、永不抛异常，
 * 与渲染层解耦 —— 模型可以在没有画布的情况下先判一遍。
 */
import { ICEGroup, ICEText, token } from 'ice-render';
import merge from 'lodash/merge';
import FlowDesigner from '../flow/FlowDesigner';
import FlowEdge from '../flow/FlowEdge';
import {
  BOTTLE_SORTER_MEDIUM_STYLES,
  BOTTLE_SORTER_SHAPE_PATHS,
  BOTTLE_SORTER_SYMBOL_PRESETS,
} from './bottleSorter_shapes';
import type {
  BottleSorterDslDocument,
  BottleSorterMedium,
  BottleSorterSymbolKind,
  BottleSorterSymbolPreset,
} from './bottleSorter_shapes';
import { applyJumpsToLink, computeLinkJumps, type LinkJumps } from '../designer/linkJumps';
import { registerIEDType } from '../utils/type-registry';

/**
 * 介质线型 → 虚线数组。与色选包同一口径：引擎 `ICEPolyLine` 只把 `'dashed'` 映射成默认虚线，
 * 点上划线得自己给 `lineDash`。整瓶图三种介质都是实线，这张表留着是为了
 * 将来加"压缩空气 / 信号"时不必再想一遍。
 */
export function dashPatternOf(lineType: 'solid' | 'dashed' | 'dashdot', lineWidth: number): number[] {
  const w = Math.max(1, lineWidth);
  if (lineType === 'dashed') return [w * 4, w * 4];
  if (lineType === 'dashdot') return [w * 7, w * 3, w * 1.5, w * 3];
  return [];
}

/**
 * 管线标注：有 `label` 就用它，否则回退成「管径 + 介质名」。
 *
 * 整瓶图的物料名（`蓝/白/绿/杂`）不是介质 —— 介质只有三种，物料名有十几种 ——
 * 所以它必须是独立的字段，不能塞进 `medium`。
 */
export function composePipeLabel(medium: BottleSorterMedium, dn: string, label?: string): string {
  if (label !== undefined && label !== '') return label;
  const style = BOTTLE_SORTER_MEDIUM_STYLES[medium] || BOTTLE_SORTER_MEDIUM_STYLES.bottle;
  const size = String(dn || '').trim();
  return size ? `${size} ${style.label}` : style.label;
}

/**
 * @class BottleSorterSymbol 整瓶分选工艺图图元（复合组件）
 *
 * `kind-first`：内部形状与文字按 `kind` 派生，不进文档、载入时按 state 重建。
 */
export class BottleSorterSymbol extends ICEGroup {
  /** 稳定的类型标识（判型与序列化都用它，不要用类名） */
  public static readonly typeId = 'ice-entity-designer:BottleSorterSymbol';

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
    super(BottleSorterSymbol.arrangeParam(props));
    this.syncShape();
  }

  protected static arrangeParam(props: any = {}) {
    const kind: BottleSorterSymbolKind = (props.kind || 'bottleSorter') as BottleSorterSymbolKind;
    const preset = BOTTLE_SORTER_SYMBOL_PRESETS[kind] || BOTTLE_SORTER_SYMBOL_PRESETS.bottleSorter;
    return merge(
      {
        kind,
        /** 位号（画在符号上方，如 `AI-101`） */
        tag: preset.tag,
        /** 设备 / 单元名称（画在符号下方） */
        name: '',
        // 自身不画：轮廓一律由派生形状绘制
        fill: false,
        stroke: false,
        width: preset.width,
        height: preset.height,
        /** 不可变换（只能拖动）：符号的比例与朝向是记法的一部分 */
        transformable: false,
      },
      props
    );
  }

  private static readonly __shapeKeys = ['kind', 'tag', 'name', 'width', 'height'];

  public setState(patch: any): void {
    const needsSync =
      !!patch && BottleSorterSymbol.__shapeKeys.some((key) => Object.prototype.hasOwnProperty.call(patch, key));
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
    const kind: BottleSorterSymbolKind = (this.state.kind || 'bottleSorter') as BottleSorterSymbolKind;
    const preset = BOTTLE_SORTER_SYMBOL_PRESETS[kind] || BOTTLE_SORTER_SYMBOL_PRESETS.bottleSorter;
    const w = this.state.width || preset.width;
    const h = this.state.height || preset.height;
    // 未知 kind 落到整瓶机画法（渲染层不抛：诊断交给 validateBottleSorter）
    const shapeFn = BOTTLE_SORTER_SHAPE_PATHS[kind] || BOTTLE_SORTER_SHAPE_PATHS.bottleSorter;
    const shape: BottleSorterSymbolPreset = { ...preset, width: w, height: h };
    this.__add('shape', shapeFn(shape));

    /**
     * 文字排版（与色选 / 给排水**同一个公式**）：位号在上、名称在下，都在符号边界外侧居中。
     *
     * ⚠️ `max(w + 24, 90)` 这三个数与字号（9.5 / 12）、`-18` / `h + 14` 的偏移必须与
     * 应用仓的落墨度量模型（`src/domain/diagram/layout.ts` 的 `inkBoxOf`）**保持一致** ——
     * 那边按同一套公式判"图元有没有叠"，公式一变，那个判据就开始说假话（而且会说"没问题"）。
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
 * @class BottleSorterPipe 整瓶分选工艺管线（整瓶流 / 复选回料 / 剔除物）
 *
 * 一条线 = 一段管线；介质决定颜色与线型，`label` 决定线上写什么字（物料名）。
 * 另外它记住"在哪些点拱起"（`__linkJumps`），并在引擎每次重算几何之后**重新套用**。
 */
export class BottleSorterPipe extends FlowEdge {
  public static readonly typeId = 'ice-entity-designer:BottleSorterPipe';

  /** 本线的跳线信息（由 `BottleSorterDesigner.applyLinkJumps()` 写入）。 */
  private __linkJumps: LinkJumps | null = null;

  /** 按当前介质刷新线型、颜色与标注 */
  public applyMediumStyle(): void {
    const medium = (this.state.medium || 'bottle') as BottleSorterMedium;
    const style = BOTTLE_SORTER_MEDIUM_STYLES[medium] || BOTTLE_SORTER_MEDIUM_STYLES.bottle;
    const label = composePipeLabel(medium, this.state.dn, this.state.label);
    this.setState({
      lineType: style.lineType === 'solid' ? 'solid' : 'dashed',
      lineDash: dashPatternOf(style.lineType, Number((this.state.style || {}).lineWidth) || 1.4),
      label,
      style: { ...(this.state.style || {}), strokeStyle: style.color, fillStyle: style.color },
    } as any);
  }

  /** 改介质（属性面板 / 工艺改线用） */
  public setMedium(medium: BottleSorterMedium, dn?: string): void {
    this.setState({ medium, label: '', dn: dn === undefined ? this.state.dn : dn } as any);
    this.applyMediumStyle();
  }

  /** 写入跳线信息（设计器算完全图交叉后调用）。 */
  public setLinkJumps(jumps: LinkJumps | null): void {
    this.__linkJumps = jumps;
  }

  /**
   * @overwrite
   * 引擎重算完折线之后，把拱起重新套上去。
   *
   * **必须挂在这一层**：`__calcDots()` 每次都用路由结果整体覆盖 `state.points`，
   * 建图后跑一遍的拱起会在下一帧被抹掉（不报错，只是"跳线时有时无"）。
   */
  protected __calcDots() {
    const dots = super.__calcDots();
    if (!this.__linkJumps) return dots;
    return applyJumpsToLink(this, this.__linkJumps);
  }
}

export default class BottleSorterDesigner extends FlowDesigner {
  /** 构造期传入的 DSL 文档（`mount()` 无参调用时回退到它） */
  private readonly __doc?: BottleSorterDslDocument;

  constructor(ice: any, doc?: BottleSorterDslDocument) {
    super(ice);
    registerIEDType(this.ice, BottleSorterSymbol);
    registerIEDType(this.ice, BottleSorterPipe);
    this.__doc = doc;
    if (doc) {
      this.mount(doc);
    }
  }

  /**
   * kind → 画法函数。9 种符号一一对应；未支持的 kind **抛错**（这是程序化建图的入口，
   * 写错了要立刻炸，不能静默画成别的符号）。
   */
  public static createSymbolPath(kind: BottleSorterSymbolKind): (preset: BottleSorterSymbolPreset) => ICEGroup {
    const fn = BOTTLE_SORTER_SHAPE_PATHS[kind as BottleSorterSymbolKind];
    if (!fn) {
      throw new Error(`unsupported bottle-sorter symbol kind: ${kind}`);
    }
    return fn;
  }

  public get nodes(): any[] {
    return this.__flatten().filter((item: any) => this.isNodeComponent(item));
  }

  public get edges(): any[] {
    return this.__flatten().filter((item: any) => this.isEdgeComponent(item));
  }

  protected isSelectableComponent(component: any): boolean {
    return (
      component instanceof BottleSorterSymbol ||
      component instanceof BottleSorterPipe ||
      super.isSelectableComponent(component)
    );
  }

  protected isNodeComponent(component: any): boolean {
    return component instanceof BottleSorterSymbol;
  }

  protected isEdgeComponent(component: any): boolean {
    return component instanceof BottleSorterPipe;
  }

  /** 建一个符号（设备 / 单元 / 边界） */
  public createSymbol(kind: BottleSorterSymbolKind, props: any = {}): any {
    this.__captureHistory();
    const node = new BottleSorterSymbol({ kind, ...props });
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
   * 端点槽位兜底是 **R → L**（与色选包、DSL 的 `DEFAULT_*_PORT` 同一条约定：
   * 工艺图主流程从左往右走）。显式传槽位仍然优先。
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
    const pipe = new BottleSorterPipe({
      id: props.id,
      links: { start: { id: props.sourceId, position: sourcePort }, end: { id: props.targetId, position: targetPort } },
      startPoint: this.__slotPoint(source, sourcePort),
      endPoint: this.__slotPoint(target, targetPort),
      medium: props.medium || 'bottle',
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
   * 算全图折线交叉并把"拱起"写进每条横向线。
   *
   * **建图之后调用一次**（改图之后要再调一次）：`BottleSorterPipe.__calcDots()` 会在每次重算
   * 几何时把拱起重新套上，所以这里只需要把"拱在哪几个点"算准。
   */
  public applyLinkJumps(): number {
    const edges = this.edges as BottleSorterPipe[];
    const polylines = new Map<string, number[][]>();
    for (const edge of edges) {
      (edge as any).recalculateRoute();
      (edge as any).__calcDots();
      polylines.set(
        String((edge as any).state.id),
        ((edge as any).state.points || []).map((p: number[]) => [p[0], p[1]])
      );
    }
    const jumps = computeLinkJumps(polylines);
    let bumped = 0;
    for (const edge of edges) {
      (edge as any).setLinkJumps(jumps);
      const hops = jumps.hops.get(String((edge as any).state.id));
      if (!hops || !hops.length) continue;
      applyJumpsToLink(edge, jumps);
      bumped += hops.length;
    }
    return bumped;
  }

  /**
   * 按 DSL 文档建图（units → 符号，pipes → 管线）。
   *
   * **不在这里算跳线**：`mount()` 的语义是"照文档建图"，跳线是画法上的再加工，
   * 由调用方在"整张图都建完/改完"之后显式调一次 `applyLinkJumps()`（本仓示例页与
   * 控制台都走这条路）。顺手算一次的话，增量改图之后那次会变成半新半旧的拱起。
   *
   * 缺省用构造期那份文档；文档缺字段按空数组处理，但**管线引用不存在的单元会抛错**
   * （那是坏文档，程序化建图不该静默吞掉；只判不建请走 `validateBottleSorter`）。
   */
  public mount(doc: BottleSorterDslDocument = this.__doc as BottleSorterDslDocument): { units: number; pipes: number } {
    const units = doc && Array.isArray(doc.units) ? doc.units : [];
    const pipes = doc && Array.isArray(doc.pipes) ? doc.pipes : [];
    units.forEach((unit) => {
      this.createSymbol(unit.kind as BottleSorterSymbolKind, {
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
        label: pipe.label,
        sourcePort: pipe.sourcePort,
        targetPort: pipe.targetPort,
      });
    });
    return { units: units.length, pipes: pipes.length };
  }
}
