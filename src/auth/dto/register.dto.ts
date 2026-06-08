import { IsString, IsNotEmpty, Matches, MinLength } from 'class-validator';

export class CreateRegisterDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^\+254\d{9}$/, {
    message: 'Phone number must be in format +254712345678',
  })
  phone!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(6, { message: 'Password must be at least 6 characters long' })
  password!: string;
}
