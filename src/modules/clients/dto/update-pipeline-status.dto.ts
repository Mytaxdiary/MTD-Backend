import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import { MANUAL_PIPELINE_STATUSES } from '../../dashboard/pipeline-status';

export class UpdatePipelineStatusDto {
  @ApiProperty({
    enum: MANUAL_PIPELINE_STATUSES,
    example: 'records-received',
    description: 'Next manual pipeline status (one step forward only)',
  })
  @IsIn([...MANUAL_PIPELINE_STATUSES])
  status: (typeof MANUAL_PIPELINE_STATUSES)[number];
}
