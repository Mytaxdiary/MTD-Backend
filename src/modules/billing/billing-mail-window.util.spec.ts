import {
  shouldSendTrialEndingEmail,
  shouldSendTrialExpiredEmail,
} from './billing-mail-window.util';

describe('billing-mail-window.util', () => {
  const now = new Date('2026-06-10T08:00:00.000Z');

  describe('shouldSendTrialEndingEmail', () => {
    it('sends when ~2 days remain on trial and not yet sent', () => {
      expect(
        shouldSendTrialEndingEmail({
          billingStatus: 'trial',
          trialEndsAt: new Date('2026-06-12T08:00:00.000Z'),
          alreadySent: false,
          now,
        }),
      ).toBe(true);
    });

    it('does not send when more than 2 days remain', () => {
      expect(
        shouldSendTrialEndingEmail({
          billingStatus: 'trial',
          trialEndsAt: new Date('2026-06-14T08:00:00.000Z'),
          alreadySent: false,
          now,
        }),
      ).toBe(false);
    });

    it('does not send when ≤1 day remains (too late for day−2)', () => {
      expect(
        shouldSendTrialEndingEmail({
          billingStatus: 'trial',
          trialEndsAt: new Date('2026-06-11T08:00:00.000Z'),
          alreadySent: false,
          now,
        }),
      ).toBe(false);
    });

    it('skips when already sent or status is not trial', () => {
      expect(
        shouldSendTrialEndingEmail({
          billingStatus: 'trial',
          trialEndsAt: new Date('2026-06-12T08:00:00.000Z'),
          alreadySent: true,
          now,
        }),
      ).toBe(false);
      expect(
        shouldSendTrialEndingEmail({
          billingStatus: 'active',
          trialEndsAt: new Date('2026-06-12T08:00:00.000Z'),
          alreadySent: false,
          now,
        }),
      ).toBe(false);
    });
  });

  describe('shouldSendTrialExpiredEmail', () => {
    it('sends when trial end is in the past and status is still trial', () => {
      expect(
        shouldSendTrialExpiredEmail({
          billingStatus: 'trial',
          trialEndsAt: new Date('2026-06-09T12:00:00.000Z'),
          alreadySent: false,
          now,
        }),
      ).toBe(true);
    });

    it('does not send before the trial ends', () => {
      expect(
        shouldSendTrialExpiredEmail({
          billingStatus: 'trial',
          trialEndsAt: new Date('2026-06-11T08:00:00.000Z'),
          alreadySent: false,
          now,
        }),
      ).toBe(false);
    });

    it('skips when already sent', () => {
      expect(
        shouldSendTrialExpiredEmail({
          billingStatus: 'trial',
          trialEndsAt: new Date('2026-06-09T12:00:00.000Z'),
          alreadySent: true,
          now,
        }),
      ).toBe(false);
    });
  });
});
