import { Type } from 'class-transformer';
import {
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateGoalDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(3, {
    message: 'Name must be at least 3 characters long',
  })
  @MaxLength(100, {
    message: 'Name must be at most 100 characters long',
  })
  name!: string;

  @IsString()
  @IsOptional()
  @MaxLength(100, {
    message: 'Description must be at most 100 characters long',
  })
  description?: string;

  @Type(() => Number)
  @IsNotEmpty()
  @IsNumber()
  @Min(10, {
    message: 'Target amount must be a minimum of KES 10',
  })
  @Max(1000000)
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
