import { Type } from 'class-transformer';
import {
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';

export class CreateGoalDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(3, {
    message: 'Name must be at least 3 characters long',
  })
  name!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @Type(() => Number)
  @IsNotEmpty()
  @IsNumber()
  @Min(1, {
    message: 'Target amount must be greater than 0',
  })
  targetAmount!: number;

  @Type(() => Number)
  @IsNotEmpty()
  @IsNumber()
  @Min(1, {
    message: 'Lock period must be greater than 0',
  })
  @IsIn([1, 3, 6, 12], {
    message: 'Lock period must be 1, 3, 6, or 12 months',
  })
  lockPeriod!: number;
}
