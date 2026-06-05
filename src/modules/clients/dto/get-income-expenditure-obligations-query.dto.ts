import { IsIn, IsOptional, IsString, Matches } from 'class-validator';

export class GetIncomeExpenditureObligationsQueryDto {
  @IsOptional()
  @IsString()
  @IsIn(['self-employment', 'uk-property', 'foreign-property'])
  typeOfBusiness?: string;

  @IsOptional()
  @IsString()
  @Matches(/^X[a-zA-Z0-9]{1}IS[0-9]{11}$/)
  businessId?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  fromDate?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  toDate?: string;

  @IsOptional()
  @IsString()
  @IsIn(['open', 'fulfilled'])
  status?: string;
}
