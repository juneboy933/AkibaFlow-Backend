import { IsString, IsNotEmpty, Matches } from 'class-validator';

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
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/, {
    message: 'Password must contain uppercase, lowercase and number',
  })
  password!: string;
}
