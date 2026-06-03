import { Client } from '../entities/client.entity';

export class ClientRelationshipStatusDto {
  client: Client;
  /** True when HMRC POST /relationships returned 204. */
  relationshipActive: boolean;
}
