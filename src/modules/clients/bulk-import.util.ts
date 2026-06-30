import { parse } from 'csv-parse/sync';
import type { BulkImportRow, BulkImportRowError } from './dto/bulk-import-client.dto';

const NINO_REGEX = /^[A-Z]{2}\d{6}[A-D]$/i;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VALID_AGENT_TYPES = new Set(['main', 'supporting']);

/** Normalise a header string to a consistent key. */
function normaliseHeader(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, '_');
}

/**
 * Parse a CSV buffer into rows.
 * Accepts files with or without a BOM (Excel export quirk).
 */
export function parseCsvBuffer(buffer: Buffer): BulkImportRow[] {
  const text = buffer.toString('utf-8').replace(/^\uFEFF/, '');

  const records = parse(text, {
    columns: (headers: string[]) => headers.map(normaliseHeader),
    skip_empty_lines: true,
    trim: true,
  }) as Record<string, string>[];

  return records.map((record, idx) => ({
    rowNumber: idx + 1,
    name: record['name'] || undefined,
    nino: record['nino'] || undefined,
    postcode: record['postcode'] || undefined,
    email: record['email'] || undefined,
    phone: record['phone'] || undefined,
    agent_type: record['agent_type'] || undefined,
    personal_message: record['personal_message'] || undefined,
  }));
}

/**
 * Validate all rows. Returns a list of errors — empty means the file is clean.
 * Also returns ninoHashes for the duplicate-check query in the service.
 */
export function validateRows(
  rows: BulkImportRow[],
  existingNinoHashes: Set<string>,
  computeHash: (nino: string) => string,
): BulkImportRowError[] {
  const errors: BulkImportRowError[] = [];
  const seenHashes = new Set<string>();

  for (const row of rows) {
    const r = row.rowNumber;

    // ── Required fields ──────────────────────────────────────────────────────
    if (!row.name?.trim()) {
      errors.push({ row: r, field: 'name', message: 'Name is required' });
    } else if (row.name.trim().length > 200) {
      errors.push({ row: r, field: 'name', message: 'Name must be 200 characters or less' });
    }

    if (!row.nino?.trim()) {
      errors.push({ row: r, field: 'nino', message: 'NINO is required' });
    } else {
      const ninoClean = row.nino.replace(/\s/g, '').toUpperCase();
      if (!NINO_REGEX.test(ninoClean)) {
        errors.push({
          row: r,
          field: 'nino',
          message: 'NINO must be 2 letters, 6 digits, 1 letter A–D (e.g. AB123456C)',
        });
      } else {
        const hash = computeHash(ninoClean);
        if (seenHashes.has(hash)) {
          errors.push({ row: r, field: 'nino', message: 'Duplicate NINO: this NINO appears more than once in the file' });
        } else if (existingNinoHashes.has(hash)) {
          errors.push({ row: r, field: 'nino', message: 'A client with this NINO already exists in your account' });
        } else {
          seenHashes.add(hash);
        }
      }
    }

    if (!row.postcode?.trim()) {
      errors.push({ row: r, field: 'postcode', message: 'Postcode is required' });
    } else if (row.postcode.trim().length > 20) {
      errors.push({ row: r, field: 'postcode', message: 'Postcode must be 20 characters or less' });
    }

    if (!row.email?.trim()) {
      errors.push({ row: r, field: 'email', message: 'Email is required' });
    } else if (!EMAIL_REGEX.test(row.email.trim())) {
      errors.push({ row: r, field: 'email', message: 'Invalid email address' });
    }

    // ── Optional fields ──────────────────────────────────────────────────────
    if (row.phone && row.phone.trim().length > 30) {
      errors.push({ row: r, field: 'phone', message: 'Phone must be 30 characters or less' });
    }

    if (row.agent_type && !VALID_AGENT_TYPES.has(row.agent_type.trim().toLowerCase())) {
      errors.push({ row: r, field: 'agent_type', message: 'agent_type must be "main" or "supporting"' });
    }

    if (row.personal_message && row.personal_message.trim().length > 1000) {
      errors.push({ row: r, field: 'personal_message', message: 'Personal message must be 1000 characters or less' });
    }
  }

  return errors;
}
