import type { Request } from 'express';
import { resolveClientSourcePort } from './fraud-prevention.parser';

function fakeReq(overrides: { headerPort?: string | string[]; socketPort?: number }): Request {
  return {
    headers: {
      ...(overrides.headerPort !== undefined
        ? { 'x-client-source-port': overrides.headerPort }
        : {}),
    },
    socket: {
      remotePort: overrides.socketPort,
    },
  } as unknown as Request;
}

describe('resolveClientSourcePort', () => {
  it('prefers nginx X-Client-Source-Port over socket port', () => {
    expect(resolveClientSourcePort(fakeReq({ headerPort: '51234', socketPort: 40112 }))).toBe(
      '51234',
    );
  });

  it('falls back to socket.remotePort when header is missing', () => {
    expect(resolveClientSourcePort(fakeReq({ socketPort: 40112 }))).toBe('40112');
  });

  it('rejects banned server ports 80 and 443', () => {
    expect(resolveClientSourcePort(fakeReq({ headerPort: '443' }))).toBeUndefined();
    expect(resolveClientSourcePort(fakeReq({ socketPort: 80 }))).toBeUndefined();
  });
});
