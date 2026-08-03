import { Column, Entity, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../../database/base.entity';
import { User } from '../../users/entities/user.entity';

/**
 * Refresh tokens table — stores hashed refresh tokens.
 * Raw tokens are never stored; only SHA-256 hashes are persisted.
 * Tokens are invalidated via is_revoked (rotation on refresh, revoke on logout).
 */
@Entity('refresh_tokens')
export class RefreshToken extends BaseEntity {
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'token_hash', type: 'varchar', length: 255 })
  tokenHash: string;

  @Column({ name: 'expires_at', type: 'datetime' })
  expiresAt: Date;

  @Column({ name: 'is_revoked', type: 'boolean', default: false })
  isRevoked: boolean;

  /**
   * Whether this session completed MFA (TOTP) at login.
   * Preserved across access-token refresh so Gov-Client-Multi-Factor
   * keeps being sent for the life of the session.
   */
  @Column({ name: 'mfa_authenticated', type: 'boolean', default: false })
  mfaAuthenticated: boolean;
}
