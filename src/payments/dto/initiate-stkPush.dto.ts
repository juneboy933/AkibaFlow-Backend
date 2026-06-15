import { Type } from 'class-transformer';
import { IsNotEmpty, IsNumber, IsString, Matches, Min } from 'class-validator';

export class InitiatePaymentDto {
  @IsString()
  @IsNotEmpty()
  goalId!: string;

  @Matches(/^(?:\+254|254|0)(?:7\d{8}|11\d{7})$/, {
    message:
      'Phone number must be in format +254712345678, 254712345678, 0712345678 or 0112345678',
  })
  @IsString()
  @IsNotEmpty()
  phone!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(10, {
    message: 'Minimum amount should be KES 10',
  })
  amount!: number;
}
