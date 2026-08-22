import { canonicalFieldKey } from './form-field-mapping';

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