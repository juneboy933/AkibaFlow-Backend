import { IsNumber, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateDepositDto {
  @Type(() => Number)
  @IsNumber()
  @Min(10, { message: 'Minimum deposit amount is KES 10' })
  amount!: number;

  @IsString()
  goalId!: string;
}
