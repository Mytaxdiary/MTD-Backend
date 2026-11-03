-- Outreach CRM tables (same DB as mtd-api).
-- Prefer TypeORM migration: 1782300000000-AddOutreachCrmTables.ts
-- This file is readable source / manual apply fallback.

-- Seed data

-- Seed sequences, handbook templates (stubs), cold E steps, and default rules.
-- Full email bodies live in playbook/MTD_Outreach_Handbook.md — CRM stores handbook_code + version.
-- Operator placeholder (change password hash in task 7)
INSERT INTO outreach_crm_users (id, email, display_name, role, is_active, password_hash)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'joe@example.com', 'Joe', 'operator', 1, NULL),
  ('22222222-2222-2222-2222-222222222222', 'farhan@example.com', 'Farhan', 'owner', 1, NULL)
ON DUPLICATE KEY UPDATE display_name = VALUES(display_name);

INSERT INTO outreach_sequences (id, code, name, channel, audience_rule, entry_condition, exit_conditions, is_active)
VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'cold_e', 'Cold email E1-E4', 'email',
   'Named or generic contacts ready for cold email', 'status=ready AND pecr_lane=A',
   'reply, unsubscribe, bounce, sequence end day 12+', 1),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2', 'trial_s', 'Trial stall S1-S3', 'email',
   'Trial signups', 'trial_signup', 'activation, reply, S3 quiet', 1),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3', 'reply', 'Reply templates R*', 'email',
   'Inbound replies', 'manual', 'n/a', 1),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa4', 'demo', 'Demo D1-D3', 'email',
   'Booked demos', 'demo_booked', 'n/a', 1),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa5', 'linkedin', 'LinkedIn LI1-LI3', 'linkedin',
   'LinkedIn prospects', 'manual', 'n/a', 1)
ON DUPLICATE KEY UPDATE name = VALUES(name);

-- Template stubs: body is a pointer note; replace with full handbook text when loading CRM
INSERT INTO outreach_templates (id, handbook_code, version, name, channel, subject, body, link_asset, merge_fields_json, author)
VALUES
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbe1', 'E1', '1.1', 'E1 First contact', 'email',
   'what if you could see every client''s MTD position in one place?',
   '[See MTD_Outreach_Handbook E1]', 'none', JSON_ARRAY('salutation'), 'handbook'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbe2', 'E2', '1.1', 'E2 Demo offer', 'email',
   'Re: what if you could see every client''s MTD position in one place?',
   '[See MTD_Outreach_Handbook E2]', 'booking', JSON_ARRAY('salutation'), 'handbook'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbe3', 'E3', '1.1', 'E3 Second demo angle', 'email',
   'Re: what if you could see every client''s MTD position in one place?',
   '[See MTD_Outreach_Handbook E3]', 'none', JSON_ARRAY('salutation'), 'handbook'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbe4', 'E4', '1.1', 'E4 Close file', 'email',
   'closing the file', '[See MTD_Outreach_Handbook E4]', 'none', JSON_ARRAY('salutation'), 'handbook'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbs1', 'S1', '1.1', 'S1 HMRC not connected', 'email',
   'nothing connected yet?', '[See MTD_Outreach_Handbook S1]', 'none', JSON_ARRAY('First name'), 'handbook'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbs2', 'S2', '1.1', 'S2 No clients added', 'email',
   'HMRC is in, the client book is not', '[See MTD_Outreach_Handbook S2]', 'none', JSON_ARRAY('First name'), 'handbook'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbs3', 'S3', '1.1', 'S3 Close empty account', 'email',
   'shall I close the account?', '[See MTD_Outreach_Handbook S3]', 'none', JSON_ARRAY('First name'), 'handbook'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbr1', 'R1', '1.1', 'R1 Interested', 'email', NULL,
   '[See MTD_Outreach_Handbook R1]', 'booking', JSON_ARRAY('First name', 'Booking link'), 'handbook'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbr2', 'R2', '1.1', 'R2 Send information', 'email', NULL,
   '[See MTD_Outreach_Handbook R2]', 'both', JSON_ARRAY('First name', 'Booking link', 'Trial link'), 'handbook'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbr3', 'R3', '1.1', 'R3 No / remove', 'email', NULL,
   '[See MTD_Outreach_Handbook R3]', 'none', JSON_ARRAY('First name'), 'handbook'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbr4', 'R4', '1.1', 'R4 Already use another approach', 'email', NULL,
   '[See MTD_Outreach_Handbook R4]', 'booking', JSON_ARRAY('First name', 'Tool name', 'Booking link'), 'handbook'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbr5', 'R5', '1.1', 'R5 Price', 'email', NULL,
   '[See MTD_Outreach_Handbook R5]', 'both', JSON_ARRAY('First name', 'Trial link', 'Booking link'), 'handbook'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbr6', 'R6', '1.1', 'R6 Wrong person', 'email', NULL,
   '[See MTD_Outreach_Handbook R6]', 'none', JSON_ARRAY('First name', 'Referred name'), 'handbook'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbr6b', 'R6b', '1.1', 'R6b Referral intro', 'email',
   'what if you could see every client''s MTD position in one place?',
   '[See MTD_Outreach_Handbook R6b]', 'booking',
   JSON_ARRAY('Referred first name', 'Referrer first name', 'Company', 'Booking link'), 'handbook'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbr7', 'R7', '1.1', 'R7 Escalate', 'email', NULL,
   '[See MTD_Outreach_Handbook R7]', 'none', JSON_ARRAY('First name', 'day'), 'handbook'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbr8', 'R8', '1.1', 'R8 Phone call', 'email', NULL,
   '[See MTD_Outreach_Handbook R8]', 'booking', JSON_ARRAY('First name', 'Booking link'), 'handbook'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbr9', 'R9', '1.1', 'R9 Not now', 'email', NULL,
   '[See MTD_Outreach_Handbook R9]', 'none', JSON_ARRAY('First name', 'Month'), 'handbook'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbd1', 'D1', '1.1', 'D1 Demo confirm', 'email', NULL,
   '[See MTD_Outreach_Handbook D1]', 'none', JSON_ARRAY('First name', 'day', 'time'), 'handbook'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbd2', 'D2', '1.1', 'D2 Missed demo', 'email', NULL,
   '[See MTD_Outreach_Handbook D2]', 'booking', JSON_ARRAY('First name', 'time', 'Booking link'), 'handbook'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbd3', 'D3', '1.1', 'D3 After demo', 'email', NULL,
   '[See MTD_Outreach_Handbook D3]', 'trial', JSON_ARRAY('First name', 'Trial link'), 'handbook'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbli1', 'LI1', '1.1', 'LI1 Connection note', 'linkedin', NULL,
   '[See MTD_Outreach_Handbook LI1]', 'none', JSON_ARRAY('First name'), 'handbook'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbli2', 'LI2', '1.1', 'LI2 After accept', 'linkedin', NULL,
   '[See MTD_Outreach_Handbook LI2]', 'none', JSON_ARRAY('First name'), 'handbook'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbli3', 'LI3', '1.1', 'LI3 Interested book', 'linkedin', NULL,
   '[See MTD_Outreach_Handbook LI3]', 'booking', JSON_ARRAY('Booking link'), 'handbook')
ON DUPLICATE KEY UPDATE name = VALUES(name);

-- Cold sequence steps: day 0 / 2 / 7 / 12 (MTD handbook, not Dash 0/5/11)
INSERT INTO outreach_sequence_steps (
  id, sequence_id, step_number, day_offset, trigger_event, template_id, channel, requires_link, executor
) VALUES
  ('cccccccc-cccc-cccc-cccc-cccccccccc01', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 1, 0, NULL,
   'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbe1', 'email', 0, 'instantly'),
  ('cccccccc-cccc-cccc-cccc-cccccccccc02', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 2, 2, NULL,
   'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbe2', 'email', 1, 'instantly'),
  ('cccccccc-cccc-cccc-cccc-cccccccccc03', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 3, 7, NULL,
   'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbe3', 'email', 0, 'instantly'),
  ('cccccccc-cccc-cccc-cccc-cccccccccc04', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 4, 12, NULL,
   'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbe4', 'email', 0, 'instantly'),
  ('cccccccc-cccc-cccc-cccc-cccccccccc11', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2', 1, NULL, 'trial_signup',
   'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbs1', 'email', 0, 'person'),
  ('cccccccc-cccc-cccc-cccc-cccccccccc12', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2', 2, NULL, 'hmrc_connected',
   'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbs2', 'email', 0, 'person'),
  ('cccccccc-cccc-cccc-cccc-cccccccccc13', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2', 3, NULL, 's1_or_s2_no_reply',
   'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbs3', 'email', 0, 'person')
ON DUPLICATE KEY UPDATE template_id = VALUES(template_id);

INSERT INTO outreach_rule_configs (id, rule_group, rule_code, title, config_json, is_active) VALUES
  ('dddddddd-dddd-dddd-dddd-dddddddddd01', 'global_send', 'G1', 'Send window',
   JSON_OBJECT('days', JSON_ARRAY('Mon','Tue','Wed','Thu'), 'start', '08:00', 'end', '16:00', 'tz', 'Europe/London'), 1),
  ('dddddddd-dddd-dddd-dddd-dddddddddd02', 'global_send', 'G2', 'Daily volume cap',
   JSON_OBJECT('max_per_mailbox_per_day', 30), 1),
  ('dddddddd-dddd-dddd-dddd-dddddddddd03', 'global_send', 'G5', 'Cross-channel cap',
   JSON_OBJECT('max_outbound_touches', 2, 'window_days', 7), 1),
  ('dddddddd-dddd-dddd-dddd-dddddddddd04', 'response', 'SLA_interested', 'Interested reply SLA',
   JSON_OBJECT('reply_within_working_hours', 4, 'template', 'R1'), 1),
  ('dddddddd-dddd-dddd-dddd-dddddddddd05', 're_outreach', 'R1_unresponsive', 'Unresponsive park',
   JSON_OBJECT('return_after_days', 90, 'cycle_cap_12m', 3), 1),
  ('dddddddd-dddd-dddd-dddd-dddddddddd06', 'compliance', 'K3', 'Suppression check',
   JSON_OBJECT('check_on_every_release', true), 1)
ON DUPLICATE KEY UPDATE title = VALUES(title);
