import { IsNumber, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateWithdrawDto {
  @Type(() => Number)
  @IsNumber()
  @Min(10, { message: 'Minimum withdrawal amount should be KES 10' })
  amount!: number;

  @IsString()
  goalId!: string;
}
