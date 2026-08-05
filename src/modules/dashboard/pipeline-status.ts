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

/** Derive automatic Phase-1 status (manual statuses come in Phase 2). */
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
