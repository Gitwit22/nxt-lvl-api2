import {
  FieldDefinitionConflictError,
  inventoryTemplateFields,
  mergeTemplateFields,
  renderedSectionsReferenceTemplate,
} from './form-template-cleanup';

const question = {
  id: 'growth-goal',
  label: 'What is your growth goal?',
  type: 'textarea',
  required: true,
  helpText: 'Describe the next twelve months.',
};

describe('form template cleanup helpers', () => {
  it('distinguishes valid fields from corrupted nested arrays', () => {
    expect(inventoryTemplateFields([])).toMatchObject({
      shape: 'array', rawCount: 0, invalidElementCount: 0, validFields: [],
    });
    expect(inventoryTemplateFields([[]])).toMatchObject({
      shape: 'array', rawCount: 1, invalidElementCount: 1, validFields: [],
    });
    expect(inventoryTemplateFields([question])).toMatchObject({
      shape: 'array', rawCount: 1, invalidElementCount: 0, validFields: [question],
    });
    expect(inventoryTemplateFields({ fields: [question] })).toMatchObject({
      shape: 'non_array', rawCount: 0, validFields: [],
    });
  });

  it('reports duplicate field IDs', () => {
    expect(inventoryTemplateFields([question, { ...question }]).duplicateIds)
      .toEqual(['growth-goal']);
  });

  it('preserves survivor order and appends unique retiring fields', () => {
    const survivor = { id: 'stage', label: 'Stage', type: 'select', required: true };
    const result = mergeTemplateFields([survivor], [question]);

    expect(result.fields).toEqual([survivor, question]);
    expect(result.appendedIds).toEqual(['growth-goal']);
    expect(result.identicalIds).toEqual([]);
    expect(result.resolvedConflicts).toEqual([]);
  });

  it('collapses identical fields regardless of object key order', () => {
    const reordered = {
      required: true,
      type: 'textarea',
      label: 'What is your growth goal?',
      id: 'growth-goal',
      helpText: 'Describe the next twelve months.',
    };

    expect(mergeTemplateFields([question], [reordered])).toMatchObject({
      fields: [question],
      appendedIds: [],
      identicalIds: ['growth-goal'],
      resolvedConflicts: [],
    });
  });

  it('keeps the survivor only for an explicitly resolved conflict', () => {
    const retiring = { ...question, label: 'Retiring label', required: false };

    expect(mergeTemplateFields([question], [retiring], { 'growth-goal': 'survivor' }))
      .toEqual({
        fields: [question],
        appendedIds: [],
        identicalIds: [],
        resolvedConflicts: [{ fieldId: 'growth-goal', resolution: 'survivor' }],
      });
  });

  it('rejects conflicting definitions for the same field ID', () => {
    try {
      mergeTemplateFields([question], [{ ...question, label: 'Different label' }]);
      throw new Error('Expected merge to reject the conflict.');
    } catch (error) {
      expect(error).toBeInstanceOf(FieldDefinitionConflictError);
      expect(error).toMatchObject({
        fieldId: 'growth-goal',
        survivor: question,
        retiring: { ...question, label: 'Different label' },
      });
    }
  });

  it('finds template IDs embedded in rendered sections', () => {
    const sections = [
      { templateId: 'form-interest', kind: 'core' },
      { templateId: 'form-inspired-detroit', kind: 'program' },
    ];

    expect(renderedSectionsReferenceTemplate(sections, 'form-inspired-detroit')).toBe(true);
    expect(renderedSectionsReferenceTemplate(sections, 'form-growth-partnership')).toBe(false);
  });
});
