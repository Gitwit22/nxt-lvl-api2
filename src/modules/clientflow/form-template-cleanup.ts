import type { PublicFormFieldShape } from './form-field-mapping';

export interface FieldInventory {
  shape: 'array' | 'non_array';
  rawCount: number;
  validFields: PublicFormFieldShape[];
  invalidElementCount: number;
  duplicateIds: string[];
}

export interface FieldMergeResult {
  fields: PublicFormFieldShape[];
  appendedIds: string[];
  identicalIds: string[];
  resolvedConflicts: Array<{
    fieldId: string;
    resolution: 'survivor' | 'retiring';
  }>;
}

export class FieldDefinitionConflictError extends Error {
  constructor(
    public readonly fieldId: string,
    public readonly survivor: PublicFormFieldShape,
    public readonly retiring: PublicFormFieldShape,
  ) {
    super(`Conflicting field definition for ID ${fieldId}.`);
    this.name = 'FieldDefinitionConflictError';
  }
}

function isField(value: unknown): value is PublicFormFieldShape {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const field = value as Record<string, unknown>;
  return typeof field.id === 'string'
    && field.id.trim().length > 0
    && typeof field.label === 'string'
    && field.label.trim().length > 0
    && typeof field.type === 'string'
    && typeof field.required === 'boolean';
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value === null || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, stableValue(item)]),
  );
}

function fieldsEqual(left: PublicFormFieldShape, right: PublicFormFieldShape): boolean {
  return JSON.stringify(stableValue(left)) === JSON.stringify(stableValue(right));
}

export function inventoryTemplateFields(rawFields: unknown): FieldInventory {
  if (!Array.isArray(rawFields)) {
    return {
      shape: 'non_array',
      rawCount: 0,
      validFields: [],
      invalidElementCount: 0,
      duplicateIds: [],
    };
  }

  const validFields = rawFields.filter(isField);
  const seen = new Set<string>();
  const duplicateIds = new Set<string>();
  for (const field of validFields) {
    if (seen.has(field.id)) duplicateIds.add(field.id);
    seen.add(field.id);
  }

  return {
    shape: 'array',
    rawCount: rawFields.length,
    validFields,
    invalidElementCount: rawFields.length - validFields.length,
    duplicateIds: [...duplicateIds],
  };
}

export function mergeTemplateFields(
  survivorFields: PublicFormFieldShape[],
  retiringFields: PublicFormFieldShape[],
  conflictResolutions: Record<string, 'survivor' | 'retiring'> = {},
): FieldMergeResult {
  const fields = [...survivorFields];
  const byId = new Map(fields.map((field) => [field.id, field]));
  const appendedIds: string[] = [];
  const identicalIds: string[] = [];
  const resolvedConflicts: FieldMergeResult['resolvedConflicts'] = [];

  for (const field of retiringFields) {
    const existing = byId.get(field.id);
    if (!existing) {
      fields.push(field);
      byId.set(field.id, field);
      appendedIds.push(field.id);
      continue;
    }
    if (!fieldsEqual(existing, field)) {
      const resolution = conflictResolutions[field.id];
      if (resolution === 'survivor') {
        resolvedConflicts.push({ fieldId: field.id, resolution });
        continue;
      }
      if (resolution === 'retiring') {
        fields[fields.findIndex(({ id }) => id === field.id)] = field;
        byId.set(field.id, field);
        resolvedConflicts.push({ fieldId: field.id, resolution });
        continue;
      }
      throw new FieldDefinitionConflictError(field.id, existing, field);
    }
    identicalIds.push(field.id);
  }

  return { fields, appendedIds, identicalIds, resolvedConflicts };
}

export function renderedSectionsReferenceTemplate(value: unknown, templateId: string): boolean {
  if (!Array.isArray(value)) return false;
  return value.some((section) => {
    if (section === null || typeof section !== 'object' || Array.isArray(section)) return false;
    return (section as Record<string, unknown>).templateId === templateId;
  });
}
