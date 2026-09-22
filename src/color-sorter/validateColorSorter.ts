/**
 * Copyright (c) 2022 大漠穷秋.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

/**
 * 色选工艺图 DSL 校验器。
 *
 * **契约（与给水排水包同口径）：永不抛异常，只给结构化诊断。**
 * 输入是「模型下一轮也会读」的那份文档，不是画布 —— 所以这里能判的只有图上可判定的结构
 * 与工艺约束，不涉及任何工艺计算（分选精度 / 带出比那是色选机自己的事）。
 *
 * 判据分两层：
 * 1. **通用结构**：文档形状、id 唯一、符号种类 / 介质取值合法、管线两端存在；
 * 2. **四条色选特有工艺约束**：
 *    ① 色选机必须接压缩空气（喷阀的动力源，没气就分选不了）；
 *    ② 成品必须有出路（至少一个被连入的 `outlet` 边界）；
 *    ③ 副品必须有出路（`rejectBin` 接 `rejectOut` 或走 `recycle` 复选回料）；
 *    ④ 振动喂料器必须在色选机**上游**（接到色选机出料端是把设备接反了）。
 */
import { isColorSorterMedium, isColorSorterSymbolKind } from './colorSorter_shapes';
import type { ColorSorterDslPipe, ColorSorterDslUnit } from './colorSorter_shapes';

export interface ColorSorterDiagnostic {
  severity: 'error' | 'warning';
  /** 出问题的位置（`units[CS-201]` / `pipes[p1].sourceId` / 空串表示整份文档） */
  path: string;
  message: string;
}

export interface ColorSorterValidationResult {
  valid: boolean;
  errors: ColorSorterDiagnostic[];
  warnings: ColorSorterDiagnostic[];
}

/** 单次上报的诊断上限（坏文档不该刷屏；`valid` 按完整清单算） */
const MAX_REPORTED = 8;

const err = (path: string, message: string): ColorSorterDiagnostic => ({ severity: 'error', path, message });
const warn = (path: string, message: string): ColorSorterDiagnostic => ({ severity: 'warning', path, message });

/** 管线的两个端点 id（防御性：坏数据也能安全取出） */
function endsOf(pipe: ColorSorterDslPipe): string[] {
  const ends: string[] = [];
  if (pipe && typeof pipe.sourceId === 'string') ends.push(pipe.sourceId);
  if (pipe && typeof pipe.targetId === 'string') ends.push(pipe.targetId);
  return ends;
}

export function validateColorSorter(doc: any): ColorSorterValidationResult {
  const errors: ColorSorterDiagnostic[] = [];
  const warnings: ColorSorterDiagnostic[] = [];

  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) {
    return { valid: false, errors: [err('', 'document 缺失或非对象')], warnings: [] };
  }
  if (doc.kind !== 'color-sorter') {
    return { valid: false, errors: [err('kind', `kind 必须是 color-sorter，实际 ${doc.kind}`)], warnings: [] };
  }

  if (!Array.isArray(doc.units)) warnings.push(warn('units', 'units 缺失或不是数组，按空处理'));
  if (!Array.isArray(doc.pipes)) warnings.push(warn('pipes', 'pipes 缺失或不是数组，按空处理'));
  const units: ColorSorterDslUnit[] = Array.isArray(doc.units) ? doc.units : [];
  const pipes: ColorSorterDslPipe[] = Array.isArray(doc.pipes) ? doc.pipes : [];

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
    if (!isColorSorterSymbolKind(unit.kind)) {
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
    if (!isColorSorterMedium(pipe.medium)) {
      errors.push(err(`pipes[${pipe.id}].medium`, `未知介质: ${pipe.medium}`));
    }
  });

  // ---------------- 四条色选特有工艺约束 ----------------

  const kindOf = (id: string): string | undefined => kindById.get(id);
  /** 所有碰到该单元的管线 */
  const pipesTouching = (id: string): ColorSorterDslPipe[] =>
    pipes.filter((pipe: any) => !!pipe && (pipe.sourceId === id || pipe.targetId === id));
  /** 该单元通过管线连到的对端 id 列表 */
  const neighborsOf = (id: string): string[] => {
    const neighbors: string[] = [];
    pipesTouching(id).forEach((pipe) => {
      endsOf(pipe).forEach((end) => {
        if (end !== id) neighbors.push(end);
      });
    });
    return neighbors;
  };

  // ① 色选机必须接压缩空气
  units
    .filter((unit: any) => unit && unit.kind === 'colorSorter' && typeof unit.id === 'string')
    .forEach((unit: any) => {
      const hasAir = pipesTouching(unit.id).some((pipe: any) => pipe.medium === 'compressedAir');
      if (!hasAir) {
        errors.push(err(`units[${unit.id}]`, `色选机 (${unit.id}) 必须接压缩空气（compressedAir）管线`));
      }
    });

  // ② 成品必须有出路：至少一个 outlet 边界，且被连入
  const outlets = units.filter((unit: any) => unit && unit.kind === 'outlet');
  if (!outlets.length) {
    errors.push(err('units', '成品必须有出路（至少一个 outlet 边界）'));
  } else {
    const connected = outlets.filter((unit: any) => typeof unit.id === 'string' && pipesTouching(unit.id).length > 0);
    if (!connected.length) {
      errors.push(
        err('units', `成品必须有出路：outlet（${outlets.map((u: any) => u.id).join(' / ')}）未被任何管线连入`)
      );
    }
  }

  // ③ 副品必须有出路：rejectBin 接 rejectOut，或走 recycle 复选回料
  units
    .filter((unit: any) => unit && unit.kind === 'rejectBin' && typeof unit.id === 'string')
    .forEach((unit: any) => {
      const toRejectOut = neighborsOf(unit.id).some((id) => kindOf(id) === 'rejectOut');
      const viaRecycle = pipesTouching(unit.id).some((pipe: any) => pipe.medium === 'recycle');
      if (!toRejectOut && !viaRecycle) {
        errors.push(err(`units[${unit.id}]`, `副品 (${unit.id}) 必须接到 rejectOut 或 recycle 介质管线`));
      }
    });

  // ④ 振动喂料器必须在色选机上游（不得从色选机出料端接收）
  units
    .filter((unit: any) => unit && unit.kind === 'vibFeeder' && typeof unit.id === 'string')
    .forEach((unit: any) => {
      const fromColorSorter = pipes.some(
        (pipe: any) => !!pipe && pipe.targetId === unit.id && kindOf(pipe.sourceId) === 'colorSorter'
      );
      if (fromColorSorter) {
        errors.push(err(`units[${unit.id}]`, `喂料器必须在色选机上游：(${unit.id}) 不应从色选机出料端接收`));
      }
    });

  return {
    valid: errors.length === 0,
    errors: errors.slice(0, MAX_REPORTED),
    warnings: warnings.slice(0, MAX_REPORTED),
  };
}

export default validateColorSorter;
