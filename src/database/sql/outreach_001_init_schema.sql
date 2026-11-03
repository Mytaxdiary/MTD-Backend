-- Outreach CRM tables (same DB as mtd-api).
-- Prefer TypeORM migration: 1782300000000-AddOutreachCrmTables.ts
-- This file is readable source / manual apply fallback.

SET NAMES utf8mb4;

-- ---------------------------------------------------------------------------
-- Operators (CRM admin users — not product tenants)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS outreach_crm_users (
  id CHAR(36) NOT NULL PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  display_name VARCHAR(120) NOT NULL,
  role ENUM('owner', 'operator') NOT NULL DEFAULT 'operator',
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  password_hash VARCHAR(255) NULL,
  createdAt DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updatedAt DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  deletedAt DATETIME(6) NULL,
  UNIQUE KEY uq_outreach_crm_users_email (email)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- Firms (prospect practices)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS outreach_firms (
  id CHAR(36) NOT NULL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  companies_house_number VARCHAR(32) NULL,
  entity_type ENUM(
    'ltd', 'llp', 'scottish_partnership', 'sole_trader',
    'unincorporated_partnership', 'unknown'
  ) NOT NULL DEFAULT 'unknown',
  pecr_lane ENUM('A', 'B', 'unknown') NOT NULL DEFAULT 'unknown',
  size_band ENUM(
    'sole_practitioner', '2_to_5', '6_to_10', '11_to_50', '51_plus', 'unknown'
  ) NOT NULL DEFAULT 'unknown',
  list_tier ENUM(
    'A_named', 'B_generic', 'C_verify_first', 'D_do_not_send',
    'E_no_email', 'inbound', 'referral'
  ) NOT NULL DEFAULT 'C_verify_first',
  engaged_flag TINYINT(1) NOT NULL DEFAULT 0,
  website VARCHAR(512) NULL,
  domain VARCHAR(255) NULL,
  linkedin_url VARCHAR(512) NULL,
  -- Optional only (MTD: not a required product field)
  accounting_software ENUM('xero', 'quickbooks', 'sage', 'other', 'unknown')
    NOT NULL DEFAULT 'unknown',
  source ENUM(
    'linkedin_campaign', 'sales_navigator', 'inbound_web', 'inbound_linkedin',
    'referral', 'event', 'import', 'other'
  ) NOT NULL DEFAULT 'other',
  status ENUM(
    'new', 'blocked', 'ready', 'in_sequence', 'engaged', 'in_conversation',
    'trial', 'customer', 'unresponsive', 'parked', 'archived'
  ) NOT NULL DEFAULT 'new',
  owner_user_id CHAR(36) NULL,
  competitor_incumbent VARCHAR(255) NULL,
  renewal_month TINYINT UNSIGNED NULL COMMENT '1-12',
  fit_score INT NULL,
  notes TEXT NULL,
  createdAt DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updatedAt DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  deletedAt DATETIME(6) NULL,
  KEY idx_outreach_firms_domain (domain),
  KEY idx_outreach_firms_status (status),
  KEY idx_outreach_firms_pecr (pecr_lane),
  KEY idx_outreach_firms_owner (owner_user_id),
  CONSTRAINT fk_outreach_firms_owner FOREIGN KEY (owner_user_id) REFERENCES outreach_crm_users (id)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- Sequences / templates (declared before contacts for FKs)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS outreach_sequences (
  id CHAR(36) NOT NULL PRIMARY KEY,
  code VARCHAR(64) NOT NULL,
  name VARCHAR(120) NOT NULL,
  channel ENUM('email', 'linkedin', 'mixed') NOT NULL DEFAULT 'email',
  audience_rule TEXT NULL,
  entry_condition TEXT NULL,
  exit_conditions TEXT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  createdAt DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updatedAt DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  deletedAt DATETIME(6) NULL,
  UNIQUE KEY uq_outreach_sequences_code (code)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS outreach_templates (
  id CHAR(36) NOT NULL PRIMARY KEY,
  handbook_code VARCHAR(32) NOT NULL COMMENT 'E1, R5, S1, LI2, …',
  version VARCHAR(32) NOT NULL DEFAULT '1.0',
  name VARCHAR(160) NOT NULL,
  channel ENUM('email', 'linkedin') NOT NULL DEFAULT 'email',
  subject VARCHAR(512) NULL,
  body MEDIUMTEXT NOT NULL,
  link_asset ENUM('none', 'booking', 'trial', 'both') NOT NULL DEFAULT 'none',
  merge_fields_json JSON NULL,
  author VARCHAR(120) NULL,
  retired_at DATETIME(6) NULL,
  createdAt DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updatedAt DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  deletedAt DATETIME(6) NULL,
  UNIQUE KEY uq_outreach_templates_code_version (handbook_code, version),
  KEY idx_outreach_templates_code (handbook_code)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS outreach_sequence_steps (
  id CHAR(36) NOT NULL PRIMARY KEY,
  sequence_id CHAR(36) NOT NULL,
  step_number INT NOT NULL,
  day_offset INT NULL COMMENT 'Calendar days from step 1; null if event-triggered',
  trigger_event VARCHAR(64) NULL COMMENT 'e.g. trial_signup, hmrc_connected',
  template_id CHAR(36) NOT NULL,
  channel ENUM('email', 'linkedin') NOT NULL DEFAULT 'email',
  requires_link TINYINT(1) NOT NULL DEFAULT 0,
  executor ENUM('instantly', 'person') NOT NULL DEFAULT 'person',
  createdAt DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updatedAt DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  deletedAt DATETIME(6) NULL,
  UNIQUE KEY uq_outreach_sequence_step (sequence_id, step_number),
  KEY idx_outreach_steps_template (template_id),
  CONSTRAINT fk_outreach_steps_sequence FOREIGN KEY (sequence_id) REFERENCES outreach_sequences (id),
  CONSTRAINT fk_outreach_steps_template FOREIGN KEY (template_id) REFERENCES outreach_templates (id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS outreach_campaigns (
  id CHAR(36) NOT NULL PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  utm_campaign VARCHAR(160) NULL,
  sequence_id CHAR(36) NOT NULL,
  wave_number INT NOT NULL DEFAULT 1,
  wave_started DATE NULL,
  arm VARCHAR(64) NULL,
  variable_under_test VARCHAR(160) NULL,
  contact_count INT NOT NULL DEFAULT 0,
  instantly_campaign_id VARCHAR(128) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  release_held TINYINT(1) NOT NULL DEFAULT 1,
  createdAt DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updatedAt DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  deletedAt DATETIME(6) NULL,
  KEY idx_outreach_campaigns_sequence (sequence_id),
  CONSTRAINT fk_outreach_campaigns_sequence FOREIGN KEY (sequence_id) REFERENCES outreach_sequences (id)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- Contacts (recipient_id is the permanent external spine)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS outreach_contacts (
  id CHAR(36) NOT NULL PRIMARY KEY,
  recipient_id VARCHAR(64) NOT NULL COMMENT 'Never reissued; Instantly or CRM-issued',
  firm_id CHAR(36) NOT NULL,
  first_name VARCHAR(120) NULL,
  last_name VARCHAR(120) NULL,
  name_verified TINYINT(1) NOT NULL DEFAULT 0,
  salutation VARCHAR(64) NOT NULL DEFAULT 'Hello,',
  email VARCHAR(255) NOT NULL,
  email_status ENUM(
    'found', 'verified', 'unverified', 'bounced', 'invalid', 'generic_inbox'
  ) NOT NULL DEFAULT 'unverified',
  email_type ENUM('named_person', 'generic_inbox', 'role') NOT NULL DEFAULT 'named_person',
  role_title VARCHAR(160) NULL,
  linkedin_url VARCHAR(512) NULL,
  linkedin_connection_status ENUM(
    'not_sent', 'requested', 'accepted', 'declined_or_ignored'
  ) NOT NULL DEFAULT 'not_sent',
  phone VARCHAR(64) NULL,
  ctps_tps_screened_on DATE NULL,
  channel_preference VARCHAR(64) NULL,
  do_not_contact TINYINT(1) NOT NULL DEFAULT 0,
  send_held TINYINT(1) NOT NULL DEFAULT 1,
  status ENUM(
    'new', 'blocked', 'ready', 'in_sequence', 'engaged', 'in_conversation',
    'trial', 'customer', 'unresponsive', 'parked', 'archived'
  ) NOT NULL DEFAULT 'new',
  current_sequence_id CHAR(36) NULL,
  current_step INT NULL,
  next_action_type ENUM(
    'none', 'reply', 'send_step', 'linkedin', 'call', 'prepare_demo',
    'follow_up', 'review_parked', 'verify_data'
  ) NOT NULL DEFAULT 'none',
  next_action_due DATETIME(6) NULL,
  next_action_owner_id CHAR(36) NULL,
  reapproach_date DATE NULL,
  reapproach_angle_required VARCHAR(255) NULL,
  reapproach_cycles INT NOT NULL DEFAULT 0,
  first_touch_source VARCHAR(160) NULL,
  last_touch_source VARCHAR(160) NULL,
  notes TEXT NULL,
  createdAt DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updatedAt DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  deletedAt DATETIME(6) NULL,
  UNIQUE KEY uq_outreach_contacts_recipient (recipient_id),
  UNIQUE KEY uq_outreach_contacts_email (email),
  KEY idx_outreach_contacts_firm (firm_id),
  KEY idx_outreach_contacts_status (status),
  KEY idx_outreach_contacts_next_due (next_action_due),
  KEY idx_outreach_contacts_sequence (current_sequence_id),
  CONSTRAINT fk_outreach_contacts_firm FOREIGN KEY (firm_id) REFERENCES outreach_firms (id),
  CONSTRAINT fk_outreach_contacts_sequence FOREIGN KEY (current_sequence_id) REFERENCES outreach_sequences (id),
  CONSTRAINT fk_outreach_contacts_owner FOREIGN KEY (next_action_owner_id) REFERENCES outreach_crm_users (id)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- Touchpoints (append-only timeline)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS outreach_touchpoints (
  id CHAR(36) NOT NULL PRIMARY KEY,
  contact_id CHAR(36) NULL,
  firm_id CHAR(36) NULL,
  occurred_at DATETIME(6) NOT NULL,
  channel ENUM(
    'email_cold', 'email_lifecycle', 'email_manual',
    'linkedin_dm', 'linkedin_connection', 'linkedin_comment',
    'phone', 'direct_mail', 'website', 'product', 'calendly', 'system'
  ) NOT NULL,
  direction ENUM('outbound', 'inbound', 'system') NOT NULL,
  event_type ENUM(
    'sent', 'delivered', 'bounced_hard', 'bounced_soft', 'clicked', 'replied',
    'unsubscribed', 'complained',
    'connection_requested', 'connection_accepted', 'dm_sent', 'dm_replied',
    'comment_received', 'call_attempted', 'call_connected', 'letter_posted',
    'page_visited',
    'trial_signup', 'hmrc_connected', 'first_client_added',
    'demo_booked', 'demo_rescheduled', 'demo_cancelled', 'demo_no_show', 'demo_held',
    'send_blocked', 'note'
  ) NOT NULL,
  sequence_id CHAR(36) NULL,
  step_number INT NULL,
  template_id CHAR(36) NULL,
  template_version VARCHAR(32) NULL,
  campaign_id CHAR(36) NULL,
  arm VARCHAR(64) NULL,
  summary VARCHAR(512) NULL,
  response_category ENUM(
    'interested', 'send_information', 'not_interested', 'competitor_incumbency',
    'price_objection', 'wrong_person', 'not_now', 'ooo', 'question',
    'complaint', 'other'
  ) NULL,
  outcome VARCHAR(255) NULL,
  external_ids_json JSON NULL,
  logged_by_user_id CHAR(36) NULL,
  logged_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  block_reason ENUM(
    'lane_b', 'unverified', 'suppressed', 'do_not_contact',
    'cap_exceeded', 'outside_window', 'merge_safety', 'other'
  ) NULL,
  createdAt DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  KEY idx_outreach_touch_contact_time (contact_id, occurred_at),
  KEY idx_outreach_touch_firm_time (firm_id, occurred_at),
  KEY idx_outreach_touch_event (event_type),
  KEY idx_outreach_touch_campaign (campaign_id),
  CONSTRAINT fk_outreach_touch_contact FOREIGN KEY (contact_id) REFERENCES outreach_contacts (id),
  CONSTRAINT fk_outreach_touch_firm FOREIGN KEY (firm_id) REFERENCES outreach_firms (id),
  CONSTRAINT fk_outreach_touch_sequence FOREIGN KEY (sequence_id) REFERENCES outreach_sequences (id),
  CONSTRAINT fk_outreach_touch_template FOREIGN KEY (template_id) REFERENCES outreach_templates (id),
  CONSTRAINT fk_outreach_touch_campaign FOREIGN KEY (campaign_id) REFERENCES outreach_campaigns (id),
  CONSTRAINT fk_outreach_touch_logger FOREIGN KEY (logged_by_user_id) REFERENCES outreach_crm_users (id),
  CONSTRAINT chk_outreach_touch_subject CHECK (contact_id IS NOT NULL OR firm_id IS NOT NULL)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- Trials (product trial — MTD 7 days, HMRC + first client)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS outreach_trials (
  id CHAR(36) NOT NULL PRIMARY KEY,
  product_trial_id VARCHAR(64) NULL COMMENT 'Id from My Tax Diary product if known',
  contact_id CHAR(36) NOT NULL,
  firm_id CHAR(36) NOT NULL,
  plan VARCHAR(64) NULL COMMENT 'Unused packages; optional note only',
  signup_at DATETIME(6) NOT NULL,
  expires_at DATETIME(6) NOT NULL COMMENT 'Default signup + 7 days',
  hmrc_connected_at DATETIME(6) NULL,
  first_client_added_at DATETIME(6) NULL,
  client_count INT NOT NULL DEFAULT 0,
  converted_at DATETIME(6) NULL,
  closed_at DATETIME(6) NULL,
  attribution_json JSON NULL COMMENT 'r, utm_*',
  unattributed TINYINT(1) NOT NULL DEFAULT 0,
  createdAt DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updatedAt DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  deletedAt DATETIME(6) NULL,
  KEY idx_outreach_trials_contact (contact_id),
  KEY idx_outreach_trials_firm (firm_id),
  KEY idx_outreach_trials_signup (signup_at),
  UNIQUE KEY uq_outreach_trials_product (product_trial_id),
  CONSTRAINT fk_outreach_trials_contact FOREIGN KEY (contact_id) REFERENCES outreach_contacts (id),
  CONSTRAINT fk_outreach_trials_firm FOREIGN KEY (firm_id) REFERENCES outreach_firms (id)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- Tasks (today queue)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS outreach_tasks (
  id CHAR(36) NOT NULL PRIMARY KEY,
  contact_id CHAR(36) NOT NULL,
  type ENUM(
    'reply', 'send_step', 'linkedin', 'call', 'prepare_demo',
    'follow_up', 'review_parked', 'verify_data'
  ) NOT NULL,
  due_at DATETIME(6) NOT NULL,
  owner_user_id CHAR(36) NULL,
  priority INT NOT NULL DEFAULT 4 COMMENT '1 reply, 2 demo, 3 follow-up, 4 new send',
  generated_by_rule VARCHAR(64) NULL,
  suggested_template_id CHAR(36) NULL,
  status ENUM('open', 'done', 'skipped') NOT NULL DEFAULT 'open',
  skip_reason VARCHAR(255) NULL,
  createdAt DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updatedAt DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  deletedAt DATETIME(6) NULL,
  KEY idx_outreach_tasks_due (status, due_at),
  KEY idx_outreach_tasks_owner (owner_user_id, status, due_at),
  KEY idx_outreach_tasks_contact (contact_id),
  CONSTRAINT fk_outreach_tasks_contact FOREIGN KEY (contact_id) REFERENCES outreach_contacts (id),
  CONSTRAINT fk_outreach_tasks_owner FOREIGN KEY (owner_user_id) REFERENCES outreach_crm_users (id),
  CONSTRAINT fk_outreach_tasks_template FOREIGN KEY (suggested_template_id) REFERENCES outreach_templates (id)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- Suppressions (blacklist)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS outreach_suppressions (
  id CHAR(36) NOT NULL PRIMARY KEY,
  value VARCHAR(255) NOT NULL,
  value_type ENUM('email', 'domain') NOT NULL,
  reason ENUM(
    'unsubscribe', 'complaint', 'hard_bounce', 'lane_b',
    'existing_customer', 'competitor', 'requested_removal', 'legal', 'research', 'other'
  ) NOT NULL,
  added_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  added_by_user_id CHAR(36) NULL,
  source_touch_id CHAR(36) NULL,
  scope ENUM('all_channels', 'email_only') NOT NULL DEFAULT 'all_channels',
  notes VARCHAR(512) NULL,
  createdAt DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updatedAt DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  deletedAt DATETIME(6) NULL,
  UNIQUE KEY uq_outreach_suppressions_value_type (value, value_type),
  KEY idx_outreach_suppressions_type (value_type),
  CONSTRAINT fk_outreach_suppressions_user FOREIGN KEY (added_by_user_id) REFERENCES outreach_crm_users (id),
  CONSTRAINT fk_outreach_suppressions_touch FOREIGN KEY (source_touch_id) REFERENCES outreach_touchpoints (id)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- Rule config (cadence / response / re-outreach as JSON)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS outreach_rule_configs (
  id CHAR(36) NOT NULL PRIMARY KEY,
  rule_group ENUM('global_send', 'response', 're_outreach', 'compliance', 'other')
    NOT NULL,
  rule_code VARCHAR(64) NOT NULL,
  title VARCHAR(160) NOT NULL,
  config_json JSON NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  createdAt DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updatedAt DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  deletedAt DATETIME(6) NULL,
  UNIQUE KEY uq_outreach_rule_configs_code (rule_code)
) ENGINE=InnoDB;
