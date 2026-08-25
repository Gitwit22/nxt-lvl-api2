import {
  canonicalFieldKey,
  CORE_INTAKE_FIELDS,
  ensureCoreIntakeFields,
  normalizePublicFormFields,
} from './form-field-mapping';

describe('canonicalFieldKey', () => {
  it.each([
    ['business', 'Business name', 'businessName'],
    ['name', 'Client name', 'primaryContactName'],
    ['bizType', 'What type of business do you have?', 'businessType'],
    ['industry', 'Business type / industry', 'businessType'],
    ['description', 'Business description', 'businessDescription'],
  ])('maps %s to %s', (id, label, expected) => {
    expect(canonicalFieldKey({ id, label })).toBe(expected);
  });

  it('uses the label to distinguish preferred contact from contact name', () => {
    expect(canonicalFieldKey({ id: 'contact', label: 'Preferred contact method' }))
      .toBe('preferredContact');
    expect(canonicalFieldKey({ id: 'contact', label: 'Primary contact' }))
      .toBe('primaryContactName');
  });

  it('prefers an explicit prefill key over a custom field ID', () => {
    expect(canonicalFieldKey({
      id: 'organization-category',
      label: 'Organization category',
      prefillKey: 'businessType',
    })).toBe('businessType');
  });

  it('leaves program-specific questions unclassified', () => {
    expect(canonicalFieldKey({ id: 'revenueGoal', label: 'Revenue goal' })).toBeNull();
  });
});

describe('normalizePublicFormFields', () => {
  it('restores readable labels and valid types for malformed legacy core fields', () => {
    expect(normalizePublicFormFields([
      { id: 'name', label: '', type: 'string', required: true },
      { id: 'business', label: '   ', required: true },
      { id: 'email', label: '', type: 'email', required: true },
    ])).toEqual([
      { id: 'name', label: 'Name', type: 'text', required: true },
      { id: 'business', label: 'Business / Organization Name', type: 'text', required: true },
      { id: 'email', label: 'Email', type: 'email', required: true },
    ]);
  });

  it('drops invalid entries and duplicate field IDs', () => {
    expect(normalizePublicFormFields([
      null,
      { id: '', label: 'Missing ID', type: 'text' },
      { id: 'phone', label: '', type: 'phone' },
      { id: 'phone', label: 'Phone number', type: 'phone' },
    ])).toEqual([
      { id: 'phone', label: 'Phone', type: 'phone', required: false },
    ]);
  });
});

describe('ensureCoreIntakeFields', () => {
  it('restores all baseline fields when the stored Master Intake is empty', () => {
    expect(ensureCoreIntakeFields([])).toEqual(CORE_INTAKE_FIELDS);
  });

  it('keeps valid stored customization and inserts each missing baseline field once', () => {
    const fields = ensureCoreIntakeFields([
      { id: 'fullName', label: 'Your full name', type: 'text', required: true },
      { id: 'email', label: 'Best email address', type: 'email', required: true },
      { id: 'email', label: 'Duplicate email', type: 'email', required: false },
    ]);

    expect(fields[0]).toEqual({
      id: 'fullName', label: 'Your full name', type: 'text', required: true,
    });
    expect(fields.find((field) => field.id === 'email')?.label).toBe('Best email address');
    expect(fields.filter((field) => canonicalFieldKey(field) === 'email')).toHaveLength(1);
    expect(fields.map((field) => canonicalFieldKey(field)))
      .toEqual(CORE_INTAKE_FIELDS.map((field) => canonicalFieldKey(field)));
  });

  it('does not restore miscellaneous legacy fields into the core section', () => {
    const fields = ensureCoreIntakeFields([
      { id: 'revenueGoal', label: 'Revenue goal', type: 'number', required: false },
    ]);

    expect(fields.some((field) => field.id === 'revenueGoal')).toBe(false);
    expect(fields).toEqual(CORE_INTAKE_FIELDS);
  });
});