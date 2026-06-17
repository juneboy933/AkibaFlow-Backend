import { PlanFrequency } from '@prisma/client';
import { IsEnum, IsNumber, IsPositive } from 'class-validator';

export class UpdatePlanDto {
  @IsEnum(PlanFrequency)
  frequency?: PlanFrequency;

  @IsNumber()
  @IsPositive()
  amount?: number;
}
