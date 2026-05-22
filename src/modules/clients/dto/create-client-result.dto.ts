import { Client } from '../entities/client.entity';

/** Returned by POST /clients — client is always saved; invitation may fail separately. */
export interface CreateClientResult {
  client: Client;
  invitationSent: boolean;
  /** Set when invitationSent is false — user-facing message only. */
  warning?: string;
}
