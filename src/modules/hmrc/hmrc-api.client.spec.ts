import { BadRequestException } from '@nestjs/common';
import { HmrcApiClient } from './hmrc-api.client';
import { HmrcFraudHeadersBuilder } from './hmrc-fraud-headers.builder';
import type { HmrcFraudRequestContext } from './fraud-prevention.types';

describe('HmrcApiClient — fraud headers fail-closed', () => {
  const builder = {
    build: jest.fn().mockReturnValue({
      'Gov-Client-Connection-Method': 'WEB_APP_VIA_SERVER',
      'Gov-Client-Device-ID': 'device-1',
    }),
  } as unknown as HmrcFraudHeadersBuilder;

  const client = new HmrcApiClient(builder);

  const goodContext: HmrcFraudRequestContext = {
    userEmail: 'a@b.co.uk',
    client: {
      deviceId: 'device-1',
      userAgent: 'Mozilla/5.0',
      timezone: 'UTC+00:00',
      screens: [{ width: 1000, height: 800, scalingFactor: 1, colourDepth: 24 }],
      windowWidth: 900,
      windowHeight: 700,
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn().mockResolvedValue(new Response('{}', { status: 200 })) as jest.Mock;
  });

  it('refuses HMRC calls without fraudContext', async () => {
    await expect(
      client.fetch(
        'https://test-api.service.hmrc.gov.uk/obligations/details/AA000000A/income-and-expenditure',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('refuses incomplete client payload', async () => {
    await expect(
      client.fetch('https://example.test', {
        fraudContext: { userEmail: 'a@b.co.uk', client: null },
      }),
    ).rejects.toThrow(/Incomplete browser fraud/);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('attaches fraud headers when context is complete', async () => {
    await client.fetch('https://example.test/path', { fraudContext: goodContext });
    expect(builder.build).toHaveBeenCalledWith(goodContext);
    expect(global.fetch).toHaveBeenCalled();
    const [, init] = (global.fetch as jest.Mock).mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers['Gov-Client-Connection-Method']).toBe('WEB_APP_VIA_SERVER');
  });

  it('allows skipFraudHeaders for feedback helpers', async () => {
    await client.fetch('https://example.test/feedback', {
      skipFraudHeaders: true,
      accessToken: 'tok',
    });
    expect(builder.build).not.toHaveBeenCalled();
    expect(global.fetch).toHaveBeenCalled();
  });
});
