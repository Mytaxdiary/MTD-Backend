import { ConfigService } from '@nestjs/config';
import { clampWindowToScreens, HmrcFraudHeadersBuilder } from './hmrc-fraud-headers.builder';
import type { HmrcFraudRequestContext } from './fraud-prevention.types';

function ctx(overrides: Partial<HmrcFraudRequestContext> = {}): HmrcFraudRequestContext {
  return {
    userEmail: 'agent@firm.co.uk',
    client: {
      deviceId: 'device-1',
      userAgent: 'Mozilla/5.0',
      timezone: 'UTC+01:00',
      screens: [{ width: 1440, height: 900, scalingFactor: 1, colourDepth: 24 }],
      windowWidth: 1200,
      windowHeight: 800,
      publicIp: '203.0.113.10',
      publicPort: '49821',
      publicIpTimestamp: '2026-10-05T08:00:00.000Z',
    },
    clientPublicIp: '203.0.113.10',
    ...overrides,
  };
}

describe('HmrcFraudHeadersBuilder', () => {
  const config = {
    get: jest.fn((key: string) => {
      const map: Record<string, string> = {
        'app.env': 'development',
        'hmrc.vendorProductName': 'My Tax Diary',
        'hmrc.vendorVersion': 'mtd-api=1.0.0&mtd-app=1.0.0',
        'hmrc.vendorPublicIp': '198.51.100.1',
        'hmrc.vendorLicenseIds': 'should-not-appear',
        'hmrc.devClientPublicPort': '12345',
      };
      return map[key];
    }),
  } as unknown as ConfigService;

  const builder = new HmrcFraudHeadersBuilder(config);

  it('always sets connection method, vendor product, vendor version, and client fields', () => {
    const headers = builder.build(ctx());
    expect(headers['Gov-Client-Connection-Method']).toBe('WEB_APP_VIA_SERVER');
    expect(headers['Gov-Vendor-Product-Name']).toBe(encodeURIComponent('My Tax Diary'));
    expect(headers['Gov-Vendor-Version']).toBe('mtd-api=1.0.0&mtd-app=1.0.0');
    expect(headers['Gov-Client-Device-ID']).toBe('device-1');
    expect(headers['Gov-Client-Timezone']).toBe('UTC+01:00');
    expect(headers['Gov-Client-User-IDs']).toContain('agent%40firm.co.uk');
    expect(headers['Gov-Vendor-License-IDs']).toBeUndefined();
  });

  it('prefers server-captured clientPublicPort over browser publicPort', () => {
    const headers = builder.build(
      ctx({
        clientPublicPort: '51234',
        client: {
          deviceId: 'd',
          userAgent: 'ua',
          timezone: 'UTC+00:00',
          screens: [{ width: 1000, height: 700, scalingFactor: 1, colourDepth: 24 }],
          windowWidth: 800,
          windowHeight: 600,
          publicIp: '203.0.113.10',
          publicPort: '49821',
        },
      }),
    );
    expect(headers['Gov-Client-Public-Port']).toBe('51234');
  });

  it('in production ignores configured browser/env ports and uses server port only', () => {
    const prodConfig = {
      get: jest.fn((key: string) => {
        const map: Record<string, string> = {
          'app.env': 'production',
          'hmrc.vendorProductName': 'My Tax Diary',
          'hmrc.vendorVersion': 'mtd-api=1.0.0&mtd-app=1.0.0',
          'hmrc.vendorPublicIp': '198.51.100.1',
          'hmrc.devClientPublicPort': '49821',
        };
        return map[key];
      }),
    } as unknown as ConfigService;
    const prodBuilder = new HmrcFraudHeadersBuilder(prodConfig);

    const withoutServerPort = prodBuilder.build(
      ctx({
        clientPublicPort: undefined,
        client: {
          deviceId: 'd',
          userAgent: 'ua',
          timezone: 'UTC+00:00',
          screens: [{ width: 1000, height: 700, scalingFactor: 1, colourDepth: 24 }],
          windowWidth: 800,
          windowHeight: 600,
          publicIp: '203.0.113.10',
          publicPort: '49821',
        },
      }),
    );
    expect(withoutServerPort['Gov-Client-Public-Port']).toBeUndefined();

    const withServerPort = prodBuilder.build(ctx({ clientPublicPort: '40112' }));
    expect(withServerPort['Gov-Client-Public-Port']).toBe('40112');
  });

  it('clamps window size to screen and never sends example port 12345', () => {
    const headers = builder.build(
      ctx({
        clientPublicPort: undefined,
        client: {
          deviceId: 'd',
          userAgent: 'ua',
          timezone: 'UTC+00:00',
          screens: [{ width: 1000, height: 700, scalingFactor: 1, colourDepth: 24 }],
          windowWidth: 1600,
          windowHeight: 900,
          publicIp: '203.0.113.10',
          publicPort: '12345',
        },
      }),
    );
    expect(headers['Gov-Client-Window-Size']).toBe('width=1000&height=700');
    expect(headers['Gov-Client-Public-Port']).toBeUndefined();
  });

  it('omits Multi-Factor unless mfaAuthenticated', () => {
    expect(builder.build(ctx())['Gov-Client-Multi-Factor']).toBeUndefined();
    expect(
      builder.build(ctx({ mfaAuthenticated: true, loginAt: 1_700_000_000 }))[
        'Gov-Client-Multi-Factor'
      ],
    ).toContain('type=TOTP');
  });
});

describe('clampWindowToScreens', () => {
  it('never returns window larger than screen', () => {
    expect(
      clampWindowToScreens(2000, 1200, [
        { width: 1440, height: 900, scalingFactor: 1, colourDepth: 24 },
      ]),
    ).toEqual({ width: 1440, height: 900 });
  });
});
