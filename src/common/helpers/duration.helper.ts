/** Parses duration strings like `15m`, `1h`, `7d` into milliseconds. */
export function parseDurationToMs(duration: string, fallbackMs = 86_400_000): number {
  const match = duration.trim().match(/^(\d+)([smhd])$/i);
  if (!match) return fallbackMs;
  const value = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();
  const multipliers: Record<string, number> = {
    s: 1000,
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000,
  };
  return value * (multipliers[unit] ?? 86_400_000);
}
