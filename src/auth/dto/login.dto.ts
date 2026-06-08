import { IsString, IsNotEmpty, Matches } from 'class-validator';

export class CreateLoginDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^\+254\d{9}$/, {
    message: 'Phone number must be in format +254712345678',
  })
  phone!: string;

  @IsString()
  @IsNotEmpty()
  password!: string;
}
