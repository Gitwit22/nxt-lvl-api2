export interface MappableFormField {
  id: string;
  label: string;
  prefillKey?: string;
}

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

export function canonicalFieldKey(field: MappableFormField): string | null {
  const key = field.prefillKey ?? field.id;
  if (field.id === 'contact' && /preferred/i.test(field.label)) return 'preferredContact';
  return TOP_LEVEL_FIELD_KEYS[key]
    ?? INTAKE_FIELD_KEYS[key]
    ?? (SOCIAL_FIELD_IDS.has(field.id) ? field.id : null);
}
