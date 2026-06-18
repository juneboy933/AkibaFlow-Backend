import { IsString } from 'class-validator';
export class CreateWithdrawDto {
  @IsString()
  goalId!: string;
}
