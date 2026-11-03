/** Shared enums for Outreach CRM entities (MySQL ENUM mirrors). */

export enum CrmUserRole {
  OWNER = 'owner',
  OPERATOR = 'operator',
}

export enum EntityType {
  LTD = 'ltd',
  LLP = 'llp',
  SCOTTISH_PARTNERSHIP = 'scottish_partnership',
  SOLE_TRADER = 'sole_trader',
  UNINCORPORATED_PARTNERSHIP = 'unincorporated_partnership',
  UNKNOWN = 'unknown',
}

export enum PecrLane {
  A = 'A',
  B = 'B',
  UNKNOWN = 'unknown',
}

export enum SizeBand {
  SOLE = 'sole_practitioner',
  TWO_TO_FIVE = '2_to_5',
  SIX_TO_TEN = '6_to_10',
  ELEVEN_TO_FIFTY = '11_to_50',
  FIFTY_ONE_PLUS = '51_plus',
  UNKNOWN = 'unknown',
}

export enum ListTier {
  A_NAMED = 'A_named',
  B_GENERIC = 'B_generic',
  C_VERIFY = 'C_verify_first',
  D_DO_NOT_SEND = 'D_do_not_send',
  E_NO_EMAIL = 'E_no_email',
  INBOUND = 'inbound',
  REFERRAL = 'referral',
}

export enum FirmSource {
  LINKEDIN_CAMPAIGN = 'linkedin_campaign',
  SALES_NAVIGATOR = 'sales_navigator',
  INBOUND_WEB = 'inbound_web',
  INBOUND_LINKEDIN = 'inbound_linkedin',
  REFERRAL = 'referral',
  EVENT = 'event',
  IMPORT = 'import',
  OTHER = 'other',
}

export enum ProspectStatus {
  NEW = 'new',
  BLOCKED = 'blocked',
  READY = 'ready',
  IN_SEQUENCE = 'in_sequence',
  ENGAGED = 'engaged',
  IN_CONVERSATION = 'in_conversation',
  TRIAL = 'trial',
  CUSTOMER = 'customer',
  UNRESPONSIVE = 'unresponsive',
  PARKED = 'parked',
  ARCHIVED = 'archived',
}

export enum EmailStatus {
  FOUND = 'found',
  VERIFIED = 'verified',
  UNVERIFIED = 'unverified',
  BOUNCED = 'bounced',
  INVALID = 'invalid',
  GENERIC_INBOX = 'generic_inbox',
}

export enum EmailType {
  NAMED_PERSON = 'named_person',
  GENERIC_INBOX = 'generic_inbox',
  ROLE = 'role',
}

export enum LinkedInConnectionStatus {
  NOT_SENT = 'not_sent',
  REQUESTED = 'requested',
  ACCEPTED = 'accepted',
  DECLINED_OR_IGNORED = 'declined_or_ignored',
}

export enum NextActionType {
  NONE = 'none',
  REPLY = 'reply',
  SEND_STEP = 'send_step',
  LINKEDIN = 'linkedin',
  CALL = 'call',
  PREPARE_DEMO = 'prepare_demo',
  FOLLOW_UP = 'follow_up',
  REVIEW_PARKED = 'review_parked',
  VERIFY_DATA = 'verify_data',
}

export enum TouchChannel {
  EMAIL_COLD = 'email_cold',
  EMAIL_LIFECYCLE = 'email_lifecycle',
  EMAIL_MANUAL = 'email_manual',
  LINKEDIN_DM = 'linkedin_dm',
  LINKEDIN_CONNECTION = 'linkedin_connection',
  LINKEDIN_COMMENT = 'linkedin_comment',
  PHONE = 'phone',
  DIRECT_MAIL = 'direct_mail',
  WEBSITE = 'website',
  PRODUCT = 'product',
  CALENDLY = 'calendly',
  SYSTEM = 'system',
}

export enum TouchDirection {
  OUTBOUND = 'outbound',
  INBOUND = 'inbound',
  SYSTEM = 'system',
}

export enum TouchEventType {
  SENT = 'sent',
  DELIVERED = 'delivered',
  BOUNCED_HARD = 'bounced_hard',
  BOUNCED_SOFT = 'bounced_soft',
  CLICKED = 'clicked',
  REPLIED = 'replied',
  UNSUBSCRIBED = 'unsubscribed',
  COMPLAINED = 'complained',
  CONNECTION_REQUESTED = 'connection_requested',
  CONNECTION_ACCEPTED = 'connection_accepted',
  DM_SENT = 'dm_sent',
  DM_REPLIED = 'dm_replied',
  COMMENT_RECEIVED = 'comment_received',
  CALL_ATTEMPTED = 'call_attempted',
  CALL_CONNECTED = 'call_connected',
  LETTER_POSTED = 'letter_posted',
  PAGE_VISITED = 'page_visited',
  TRIAL_SIGNUP = 'trial_signup',
  HMRC_CONNECTED = 'hmrc_connected',
  FIRST_CLIENT_ADDED = 'first_client_added',
  DEMO_BOOKED = 'demo_booked',
  DEMO_RESCHEDULED = 'demo_rescheduled',
  DEMO_CANCELLED = 'demo_cancelled',
  DEMO_NO_SHOW = 'demo_no_show',
  DEMO_HELD = 'demo_held',
  SEND_BLOCKED = 'send_blocked',
  NOTE = 'note',
}

export enum ResponseCategory {
  INTERESTED = 'interested',
  SEND_INFORMATION = 'send_information',
  NOT_INTERESTED = 'not_interested',
  COMPETITOR_INCUMBENCY = 'competitor_incumbency',
  PRICE_OBJECTION = 'price_objection',
  WRONG_PERSON = 'wrong_person',
  NOT_NOW = 'not_now',
  OOO = 'ooo',
  QUESTION = 'question',
  COMPLAINT = 'complaint',
  OTHER = 'other',
}

export enum BlockReason {
  LANE_B = 'lane_b',
  UNVERIFIED = 'unverified',
  SUPPRESSED = 'suppressed',
  DO_NOT_CONTACT = 'do_not_contact',
  CAP_EXCEEDED = 'cap_exceeded',
  OUTSIDE_WINDOW = 'outside_window',
  MERGE_SAFETY = 'merge_safety',
  OTHER = 'other',
}

export enum SequenceChannel {
  EMAIL = 'email',
  LINKEDIN = 'linkedin',
  MIXED = 'mixed',
}

export enum TemplateChannel {
  EMAIL = 'email',
  LINKEDIN = 'linkedin',
}

export enum LinkAsset {
  NONE = 'none',
  BOOKING = 'booking',
  TRIAL = 'trial',
  BOTH = 'both',
}

export enum StepExecutor {
  INSTANTLY = 'instantly',
  PERSON = 'person',
}

export enum TaskType {
  REPLY = 'reply',
  SEND_STEP = 'send_step',
  LINKEDIN = 'linkedin',
  CALL = 'call',
  PREPARE_DEMO = 'prepare_demo',
  FOLLOW_UP = 'follow_up',
  REVIEW_PARKED = 'review_parked',
  VERIFY_DATA = 'verify_data',
}

export enum TaskStatus {
  OPEN = 'open',
  DONE = 'done',
  SKIPPED = 'skipped',
}

export enum SuppressionValueType {
  EMAIL = 'email',
  DOMAIN = 'domain',
}

export enum SuppressionReason {
  UNSUBSCRIBE = 'unsubscribe',
  COMPLAINT = 'complaint',
  HARD_BOUNCE = 'hard_bounce',
  LANE_B = 'lane_b',
  EXISTING_CUSTOMER = 'existing_customer',
  COMPETITOR = 'competitor',
  REQUESTED_REMOVAL = 'requested_removal',
  LEGAL = 'legal',
  RESEARCH = 'research',
  OTHER = 'other',
}

export enum SuppressionScope {
  ALL_CHANNELS = 'all_channels',
  EMAIL_ONLY = 'email_only',
}

export enum RuleGroup {
  GLOBAL_SEND = 'global_send',
  RESPONSE = 'response',
  RE_OUTREACH = 're_outreach',
  COMPLIANCE = 'compliance',
  OTHER = 'other',
}
