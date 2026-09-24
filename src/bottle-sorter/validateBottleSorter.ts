/**
 * Copyright (c) 2022 大漠穷秋.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

/**
 * 整瓶分选工艺图 DSL 校验器。
 *
 * **契约（与色选 / 给排水包同口径）：永不抛异常，只给结构化诊断。**
 * 输入是「模型下一轮也会读」的那份文档，不是画布 —— 能判的只有图上可判定的结构
 * 与工艺约束，不涉及任何工艺计算（识别率 / 处理量那是分选机自己的事）。
 *
 * 判据分两层：
 * 1. **通用结构**：文档形状、id 唯一、符号种类 / 介质取值合法、管线两端存在；
 * 2. **三条整瓶特有工艺约束**：
 *    ① 来料必须接下游（`inlet` 是整个工段的起点，没有出线就是一张断头的图）；
 *    ② 每只分色瓶仓必须有来源（仓不能凭空出现物料）；
 *    ③ 每只分色瓶仓必须下接一台称重秤（仓是容器、秤是计量点，参考图里仓仓带秤）。
 */
import { isBottleSorterMedium, isBottleSorterSymbolKind } from './bottleSorter_shapes';
import type { BottleSorterDslPipe, BottleSorterDslUnit } from './bottleSorter_shapes';

export interface BottleSorterDiagnostic {
  severity: 'error' | 'warning';
  /** 出问题的位置（`units[AI-101]` / `pipes[p1].sourceId` / 空串表示整份文档） */
  path: string;
  message: string;
}

export interface BottleSorterValidationResult {
  valid: boolean;
  errors: BottleSorterDiagnostic[];
  warnings: BottleSorterDiagnostic[];
}

/** 单次上报的诊断上限（坏文档不该刷屏；`valid` 按完整清单算） */
const MAX_REPORTED = 8;

const err = (path: string, message: string): BottleSorterDiagnostic => ({ severity: 'error', path, message });
const warn = (path: string, message: string): BottleSorterDiagnostic => ({ severity: 'warning', path, message });

/** 管线的两个端点 id（防御性：坏数据也能安全取出） */
function endsOf(pipe: BottleSorterDslPipe): string[] {
  const ends: string[] = [];
  if (pipe && typeof pipe.sourceId === 'string') ends.push(pipe.sourceId);
  if (pipe && typeof pipe.targetId === 'string') ends.push(pipe.targetId);
  return ends;
}

export function validateBottleSorter(doc: any): BottleSorterValidationResult {
  const errors: BottleSorterDiagnostic[] = [];
  const warnings: BottleSorterDiagnostic[] = [];

  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) {
    return { valid: false, errors: [err('', 'document 缺失或非对象')], warnings: [] };
  }
  if (doc.kind !== 'bottle-sorter') {
    return { valid: false, errors: [err('kind', `kind 必须是 bottle-sorter，实际 ${doc.kind}`)], warnings: [] };
  }

  if (!Array.isArray(doc.units)) warnings.push(warn('units', 'units 缺失或不是数组，按空处理'));
  if (!Array.isArray(doc.pipes)) warnings.push(warn('pipes', 'pipes 缺失或不是数组，按空处理'));
  const units: BottleSorterDslUnit[] = Array.isArray(doc.units) ? doc.units : [];
  const pipes: BottleSorterDslPipe[] = Array.isArray(doc.pipes) ? doc.pipes : [];

  // ---------------- 通用结构 ----------------

  const idSet = new Set<string>();
  const kindById = new Map<string, string>();
  units.forEach((unit: any, index: number) => {
    if (!unit || typeof unit !== 'object') {
      errors.push(err(`units[${index}]`, '单元必须是对象'));
      return;
    }
    if (typeof unit.id !== 'string' || !unit.id) {
      errors.push(err(`units[${index}]`, '单元必须有 id'));
      return;
    }
    if (idSet.has(unit.id)) errors.push(err(`units[${unit.id}]`, `id 重复: ${unit.id}`));
    idSet.add(unit.id);
    if (!isBottleSorterSymbolKind(unit.kind)) {
      errors.push(err(`units[${unit.id}].kind`, `未知符号种类: ${unit.kind}`));
    } else {
      kindById.set(unit.id, unit.kind);
    }
  });

  const pipeIds = new Set<string>();
  pipes.forEach((pipe: any, index: number) => {
    if (!pipe || typeof pipe !== 'object') {
      errors.push(err(`pipes[${index}]`, '管线必须是对象'));
      return;
    }
    if (typeof pipe.id !== 'string' || !pipe.id) {
      errors.push(err(`pipes[${index}]`, '管线必须有 id'));
      return;
    }
    if (pipeIds.has(pipe.id)) errors.push(err(`pipes[${pipe.id}]`, `id 重复: ${pipe.id}`));
    pipeIds.add(pipe.id);
    if (!idSet.has(pipe.sourceId)) errors.push(err(`pipes[${pipe.id}].sourceId`, `单元 ${pipe.sourceId} 不存在`));
    if (!idSet.has(pipe.targetId)) errors.push(err(`pipes[${pipe.id}].targetId`, `单元 ${pipe.targetId} 不存在`));
    if (!isBottleSorterMedium(pipe.medium)) {
      errors.push(err(`pipes[${pipe.id}].medium`, `未知介质: ${pipe.medium}`));
    }
  });

  // ---------------- 三条整瓶特有工艺约束 ----------------

  const kindOf = (id: string): string | undefined => kindById.get(id);
  const pipesTouching = (id: string): BottleSorterDslPipe[] =>
    pipes.filter((pipe: any) => !!pipe && (pipe.sourceId === id || pipe.targetId === id));
  const outgoingOf = (id: string): BottleSorterDslPipe[] => pipes.filter((pipe: any) => !!pipe && pipe.sourceId === id);

  // ① 来料必须有去处
  units
    .filter((unit: any) => unit && unit.kind === 'inlet' && typeof unit.id === 'string')
    .forEach((unit: any) => {
      if (outgoingOf(unit.id).length === 0) {
        errors.push(err(`units[${unit.id}]`, `来料 (${unit.id}) 必须接到下游工序：它没有任何出线`));
      }
    });

  // ② 分色瓶仓必须有来源
  units
    .filter((unit: any) => unit && unit.kind === 'bottleBin' && typeof unit.id === 'string')
    .forEach((unit: any) => {
      const hasIncoming = pipesTouching(unit.id).some((pipe: any) => pipe.targetId === unit.id);
      if (!hasIncoming) {
        errors.push(err(`units[${unit.id}]`, `分色瓶仓 (${unit.id}) 必须有来源：没有任何管线连入`));
      }
    });

  // ③ 分色瓶仓必须下接一台称重秤
  units
    .filter((unit: any) => unit && unit.kind === 'bottleBin' && typeof unit.id === 'string')
    .forEach((unit: any) => {
      const hasScale = outgoingOf(unit.id).some((pipe: any) => kindOf(pipe.targetId) === 'bottleScale');
      if (!hasScale) {
        errors.push(err(`units[${unit.id}]`, `分色瓶仓 (${unit.id}) 必须下接一台称重秤（bottleScale）`));
      }
    });

  return {
    valid: errors.length === 0,
    errors: errors.slice(0, MAX_REPORTED),
    warnings: warnings.slice(0, MAX_REPORTED),
  };
}

export default validateBottleSorter;
