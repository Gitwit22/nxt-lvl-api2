import {
  canonicalFieldKey,
  CORE_INTAKE_FIELDS,
  ensureCoreIntakeFields,
  GRANT_ACCEPTANCE_TEXT,
  GRANT_BUSINESS_STAGE_OPTIONS,
  GRANT_REVENUE_STAGE_OPTIONS,
  isPublicFieldRequired,
  normalizeProgramFormFields,
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

  it('exposes stored required file fields as optional until uploads are supported', () => {
    expect(normalizePublicFormFields([
      { id: 'taxDocument', label: 'Tax document', type: 'file', required: true },
      { id: 'legalName', label: 'Legal name', type: 'text', required: true },
    ])).toEqual([
      { id: 'taxDocument', label: 'Tax document', type: 'file', required: false },
      { id: 'legalName', label: 'Legal name', type: 'text', required: true },
    ]);
    expect(isPublicFieldRequired({ type: 'file', required: true })).toBe(false);
    expect(isPublicFieldRequired({ type: 'text', required: true })).toBe(true);
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

  it('keeps custom questions after the baseline core fields', () => {
    const fields = ensureCoreIntakeFields([
      { id: 'revenueGoal', label: 'Revenue goal', type: 'number', required: false },
    ]);

    expect(fields.slice(0, CORE_INTAKE_FIELDS.length)).toEqual(CORE_INTAKE_FIELDS);
    expect(fields[fields.length - 1]).toEqual({
      id: 'revenueGoal',
      label: 'Revenue goal',
      type: 'number',
      required: false,
    });
  });
});

describe('normalizeProgramFormFields', () => {
  it('upgrades the Grant section and removes repeated shared intake fields', () => {
    const fields = normalizeProgramFormFields([
      { id: 'applicant', label: 'Applicant name', type: 'text', required: true },
      { id: 'purpose', label: 'Purpose of funds', type: 'textarea', required: true },
      { id: 'stage', label: 'Business stage', type: 'select', required: false },
      { id: 'revenue', label: 'Revenue stage', type: 'select', required: false },
      { id: 'documents', label: 'Required documents', type: 'file', required: true },
      { id: 'agreement', label: 'Agreement checkbox', type: 'checkbox', required: true },
      { id: 'signature', label: 'Signature placeholder', type: 'text', required: true },
    ], 'prog-grant', 'form-grant');

    expect(fields.some((field) => field.id === 'applicant')).toBe(false);
    expect(fields.find((field) => field.id === 'purpose')).toBeDefined();
    expect(fields.find((field) => field.id === 'stage')).toMatchObject({
      type: 'select', required: true, options: GRANT_BUSINESS_STAGE_OPTIONS,
    });
    expect(fields.find((field) => field.id === 'revenue')).toMatchObject({
      type: 'select', required: true, options: GRANT_REVENUE_STAGE_OPTIONS,
    });
    expect(fields.find((field) => field.id === 'documents')?.required).toBe(false);
    expect(fields.find((field) => field.id === 'agreement')).toMatchObject({
      label: 'I Accept', type: 'checkbox', required: true, helpText: GRANT_ACCEPTANCE_TEXT,
    });
    expect(fields.find((field) => field.id === 'signature')).toMatchObject({
      label: 'Signature', type: 'signature', required: true,
    });
  });

  it('leaves non-Grant program-specific fields unchanged', () => {
    expect(normalizeProgramFormFields([
      { id: 'growthGoal', label: 'Growth goal', type: 'text', required: true },
    ], 'program-1', 'section-1')).toEqual([
      { id: 'growthGoal', label: 'Growth goal', type: 'text', required: true },
    ]);
  });
});