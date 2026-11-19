import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

/**
 * One row per Stripe event.id — unique PK enforces webhook idempotency.
 * Row is inserted before side effects; deleted if handling fails so Stripe can retry.
 */
@Entity('stripe_webhook_events')
export class StripeWebhookEvent {
  @PrimaryColumn({ name: 'event_id', type: 'varchar', length: 255 })
  eventId: string;

  @Column({ name: 'event_type', type: 'varchar', length: 120 })
  eventType: string;

  @CreateDateColumn({ name: 'processed_at', type: 'datetime' })
  processedAt: Date;
}
