export interface MappableFormField {
  id: string;
  label: string;
  prefillKey?: string;
}

export interface PublicFormFieldShape extends MappableFormField {
  type: string;
  required: boolean;
  options?: string[];
}

export const CORE_INTAKE_FIELDS: PublicFormFieldShape[] = [
  { id: 'name', label: 'Name', type: 'text', required: true },
  { id: 'business', label: 'Business / Organization Name', type: 'text', required: true },
  { id: 'email', label: 'Email', type: 'email', required: true },
  { id: 'phone', label: 'Phone', type: 'phone', required: true },
  { id: 'website', label: 'Website', type: 'url', required: false },
  { id: 'facebookUrl', label: 'Facebook URL', type: 'url', required: false },
  { id: 'instagramUrl', label: 'Instagram URL', type: 'url', required: false },
  { id: 'linkedinUrl', label: 'LinkedIn URL', type: 'url', required: false },
  { id: 'tiktokUrl', label: 'TikTok URL', type: 'url', required: false },
  { id: 'youtubeUrl', label: 'YouTube URL', type: 'url', required: false },
  { id: 'businessType', label: 'Business type', type: 'text', required: true, prefillKey: 'businessType' },
  { id: 'description', label: 'Brief business description', type: 'textarea', required: true },
  { id: 'assistance', label: 'Type of assistance needed', type: 'textarea', required: true },
  { id: 'budget', label: 'Estimated budget', type: 'number', required: false },
  { id: 'start', label: 'Desired start date', type: 'date', required: false },
  {
    id: 'contact',
    label: 'Preferred contact method',
    type: 'select',
    required: false,
    options: ['Cell number', 'Work number'],
  },
  { id: 'heard', label: 'How did you hear about us?', type: 'text', required: false },
  { id: 'comments', label: 'Additional comments', type: 'textarea', required: false },
];

export const TOP_LEVEL_FIELD_KEYS: Record<string, string> = {
  businessName: 'businessName',
  primaryContactName: 'primaryContactName',
  email: 'email',
  phone: 'phone',
  website: 'website',
  business: 'businessName',
  bizName: 'businessName',
  brandName: 'businessName',
  sponsor: 'businessName',
  contact: 'primaryContactName',
  name: 'primaryContactName',
  fullName: 'primaryContactName',
  applicant: 'primaryContactName',
};

export const INTAKE_FIELD_KEYS: Record<string, string> = {
  businessDescription: 'businessDescription',
  description: 'businessDescription',
  assistanceRequested: 'assistanceRequested',
  assistance: 'assistanceRequested',
  businessType: 'businessType',
  bizType: 'businessType',
  industry: 'businessType',
  programOfInterest: 'programOfInterest',
  program: 'programOfInterest',
  budgetNeed: 'budgetNeed',
  budget: 'budgetNeed',
  preferredContact: 'preferredContact',
  contact_pref: 'preferredContact',
  heardAboutUs: 'heardAboutUs',
  heard: 'heardAboutUs',
  additionalComments: 'additionalComments',
  comments: 'additionalComments',
};

export const SOCIAL_FIELD_IDS = new Set([
  'facebookUrl',
  'instagramUrl',
  'linkedinUrl',
  'tiktokUrl',
  'youtubeUrl',
]);

const FIELD_LABELS: Record<string, string> = {
  primaryContactName: 'Name',
  businessName: 'Business / Organization Name',
  email: 'Email',
  phone: 'Phone',
  website: 'Website',
  facebookUrl: 'Facebook URL',
  instagramUrl: 'Instagram URL',
  linkedinUrl: 'LinkedIn URL',
  tiktokUrl: 'TikTok URL',
  youtubeUrl: 'YouTube URL',
  businessDescription: 'Brief business description',
  businessType: 'Business type',
  assistanceRequested: 'Type of assistance needed',
  programOfInterest: 'Program or service of interest',
  budgetNeed: 'Estimated budget',
  preferredContact: 'Preferred contact method',
  heardAboutUs: 'How did you hear about us?',
  additionalComments: 'Additional comments',
  start: 'Desired start date',
};

const FIELD_TYPES = new Set([
  'text', 'email', 'phone', 'url', 'textarea', 'number', 'date', 'select', 'file', 'checkbox',
]);

export function canonicalFieldKey(field: MappableFormField): string | null {
  const key = field.prefillKey ?? field.id;
  if (field.id === 'contact' && /preferred/i.test(field.label)) return 'preferredContact';
  return TOP_LEVEL_FIELD_KEYS[key]
    ?? INTAKE_FIELD_KEYS[key]
    ?? (SOCIAL_FIELD_IDS.has(field.id) ? field.id : null);
}

export function displayLabelForField(field: MappableFormField): string {
  const label = field.label.trim();
  if (label) return label;
  const canonical = canonicalFieldKey(field) ?? field.id;
  return FIELD_LABELS[canonical]
    ?? (field.id.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[-_]+/g, ' ').trim()
      || 'Form field');
}

export function isPublicFieldRequired(field: Pick<PublicFormFieldShape, 'type' | 'required'>): boolean {
  return field.required && field.type !== 'file';
}

export function normalizePublicFormFields(rawFields: unknown): PublicFormFieldShape[] {
  if (!Array.isArray(rawFields)) return [];
  const normalized: PublicFormFieldShape[] = [];
  const byId = new Map<string, number>();

  for (const rawField of rawFields) {
    if (!rawField || typeof rawField !== 'object') continue;
    const value = rawField as Record<string, unknown>;
    const id = typeof value.id === 'string' ? value.id.trim() : '';
    if (!id) continue;
    const label = typeof value.label === 'string' ? value.label.trim() : '';
    const type = typeof value.type === 'string' && FIELD_TYPES.has(value.type) ? value.type : 'text';
    const field: PublicFormFieldShape = {
      id,
      label: displayLabelForField({
        id,
        label,
        ...(typeof value.prefillKey === 'string' ? { prefillKey: value.prefillKey } : {}),
      }),
      type,
      required: isPublicFieldRequired({ type, required: value.required === true }),
      ...(typeof value.prefillKey === 'string' ? { prefillKey: value.prefillKey } : {}),
      ...(Array.isArray(value.options)
        ? { options: value.options.filter((option): option is string => typeof option === 'string') }
        : {}),
    };
    const existingIndex = byId.get(id);
    if (existingIndex === undefined) {
      byId.set(id, normalized.length);
      normalized.push(field);
    } else if (!label && normalized[existingIndex].label === id) {
      normalized[existingIndex] = field;
    }
  }
  return normalized;
}

export function ensureCoreIntakeFields(rawFields: unknown): PublicFormFieldShape[] {
  const normalized = normalizePublicFormFields(rawFields);
  const byCanonicalKey = new Map<string, PublicFormFieldShape>();

  for (const field of normalized) {
    const canonical = canonicalFieldKey(field);
    const key = canonical ?? `id:${field.id}`;
    if (byCanonicalKey.has(key)) continue;
    byCanonicalKey.set(key, field);
  }

  return CORE_INTAKE_FIELDS.map((baseline) => {
    const key = canonicalFieldKey(baseline) ?? `id:${baseline.id}`;
    return byCanonicalKey.get(key) ?? { ...baseline };
  });
}
