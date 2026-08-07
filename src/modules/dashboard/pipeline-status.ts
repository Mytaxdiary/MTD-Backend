/**
 * Single pipeline status used by every dashboard view (list / kanban / year).
 * Priority (highest wins): submitted > ready-for-review > records-received > chased > not-started > pending-invite
 */
export const PIPELINE_STATUSES = [
  'pending-invite',
  'not-started',
  'chased',
  'records-received',
  'ready-for-review',
  'submitted',
] as const;

export type PipelineStatus = (typeof PIPELINE_STATUSES)[number];

export const PIPELINE_STATUS_LABELS: Record<PipelineStatus, string> = {
  'pending-invite': 'Pending invite',
  'not-started': 'Not started',
  chased: 'Chased',
  'records-received': 'Records received',
  'ready-for-review': 'Ready for review',
  submitted: 'Submitted',
};

/** Agent-only forward steps (one at a time). */
export const MANUAL_PIPELINE_STATUSES = ['records-received', 'ready-for-review'] as const;
export type ManualPipelineStatus = (typeof MANUAL_PIPELINE_STATUSES)[number];

export function isPipelineStatus(value: string): value is PipelineStatus {
  return (PIPELINE_STATUSES as readonly string[]).includes(value);
}

export function isManualPipelineStatus(value: string): value is ManualPipelineStatus {
  return (MANUAL_PIPELINE_STATUSES as readonly string[]).includes(value);
}

export function pipelineStatusRank(status: PipelineStatus): number {
  return PIPELINE_STATUSES.indexOf(status);
}

/** Allowed next manual status from current, or null if none. */
export function nextManualPipelineStatus(current: PipelineStatus): ManualPipelineStatus | null {
  if (current === 'chased') return 'records-received';
  if (current === 'records-received') return 'ready-for-review';
  return null;
}

/** Derive automatic status from auth / chase / HMRC submission signals. */
export function derivePipelineStatus(input: {
  isAuthorised: boolean;
  submitted: boolean;
  chasedThisQuarter: boolean;
}): PipelineStatus {
  if (!input.isAuthorised) return 'pending-invite';
  if (input.submitted) return 'submitted';
  if (input.chasedThisQuarter) return 'chased';
  return 'not-started';
}

/**
 * Merge persisted client status with quarter-aware derived auto status.
 * Higher rank wins so manual records-received / ready-for-review stick until submitted.
 */
export function resolvePipelineStatus(
  persisted: PipelineStatus | string | null | undefined,
  derived: PipelineStatus,
): PipelineStatus {
  if (!persisted || !isPipelineStatus(persisted)) return derived;
  return pipelineStatusRank(persisted) >= pipelineStatusRank(derived) ? persisted : derived;
}
