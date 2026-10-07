import { emailDomain, isCorporateTrialDomain, isPublicMailDomain } from './email-domain.util';

describe('emailDomain helpers', () => {
  it('extracts lowercase domain and ignores +tags in local part', () => {
    expect(emailDomain('Jane+trial@NewEffect.co.uk')).toBe('neweffect.co.uk');
  });

  it('treats gmail/outlook/yahoo as public', () => {
    expect(isPublicMailDomain('gmail.com')).toBe(true);
    expect(isPublicMailDomain('outlook.com')).toBe(true);
    expect(isPublicMailDomain('yahoo.co.uk')).toBe(true);
    expect(isCorporateTrialDomain('gmail.com')).toBe(false);
  });

  it('treats custom firm domains as corporate trial domains', () => {
    expect(isCorporateTrialDomain('neweffect.co.uk')).toBe(true);
    expect(isCorporateTrialDomain('harris-accountants.com')).toBe(true);
  });

  it('returns null for invalid emails', () => {
    expect(emailDomain('not-an-email')).toBeNull();
    expect(emailDomain('@missing-local.com')).toBeNull();
  });
});
