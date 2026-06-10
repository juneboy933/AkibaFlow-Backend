import { IsNotEmpty, IsNumber, IsString, Matches, Min } from 'class-validator';

export class MpesaStkDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^\+254\d{9}$/, {
    message: 'Phone number must be in format +254712345678',
  })
  phone!: string;

  @Min(10, { message: 'Minimum amount to deposit it KES 10' })
  @IsNumber()
  amount!: number;
}
