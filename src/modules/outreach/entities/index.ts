export { CrmUser } from './crm-user.entity';
export { Firm } from './firm.entity';
export { Contact } from './contact.entity';
export { Touchpoint } from './touchpoint.entity';
export { Sequence } from './sequence.entity';
export { SequenceStep } from './sequence-step.entity';
export { Template } from './template.entity';
export { Campaign } from './campaign.entity';
export { Trial } from './trial.entity';
export { Task } from './task.entity';
export { Suppression } from './suppression.entity';
export { RuleConfig } from './rule-config.entity';

import { CrmUser } from './crm-user.entity';
import { Firm } from './firm.entity';
import { Contact } from './contact.entity';
import { Touchpoint } from './touchpoint.entity';
import { Sequence } from './sequence.entity';
import { SequenceStep } from './sequence-step.entity';
import { Template } from './template.entity';
import { Campaign } from './campaign.entity';
import { Trial } from './trial.entity';
import { Task } from './task.entity';
import { Suppression } from './suppression.entity';
import { RuleConfig } from './rule-config.entity';

/** Wired via OutreachModule TypeOrmModule.forFeature (CRUD in task 7). */
export const OUTREACH_ENTITIES = [
  CrmUser,
  Firm,
  Contact,
  Touchpoint,
  Sequence,
  SequenceStep,
  Template,
  Campaign,
  Trial,
  Task,
  Suppression,
  RuleConfig,
];
