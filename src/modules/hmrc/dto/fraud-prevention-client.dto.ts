import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

class FraudScreenDto {
  @IsInt()
  @Min(1)
  width: number;

  @IsInt()
  @Min(1)
  height: number;

  @IsNumber()
  scalingFactor: number;

  @IsInt()
  @Min(1)
  colourDepth: number;
}

/** Optional body mirror of X-Hmrc-Fraud-Context for validate endpoint. */
export class FraudPreventionClientDto {
  @IsString()
  deviceId: string;

  @IsString()
  userAgent: string;

  @IsString()
  timezone: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FraudScreenDto)
  screens: FraudScreenDto[];

  @IsInt()
  @Min(1)
  windowWidth: number;

  @IsInt()
  @Min(1)
  windowHeight: number;

  @IsOptional()
  @IsString()
  publicIp?: string;

  @IsOptional()
  @IsString()
  publicPort?: string;

  @IsOptional()
  @IsString()
  publicIpTimestamp?: string;
}
