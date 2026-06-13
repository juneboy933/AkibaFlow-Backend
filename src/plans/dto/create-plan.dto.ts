import { PlanFrequency } from '@prisma/client';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsPositive,
  IsString,
} from 'class-validator';

export class CreatePlanDto {
  @IsString()
  @IsNotEmpty()
  goalId!: string;

  @IsEnum(PlanFrequency)
  frequency!: PlanFrequency;

  @IsNumber()
  @IsPositive()
  amount!: number;
}
