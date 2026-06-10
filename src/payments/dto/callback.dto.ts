import {
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class MpesaCallbackMetadataItemDto {
  @IsString()
  @IsNotEmpty()
  Name!: string;

  @IsOptional()
  Value?: string | number;
}

class MpesaCallbackMetadataDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MpesaCallbackMetadataItemDto)
  Item!: MpesaCallbackMetadataItemDto[];
}

class MpesaStkCallbackDto {
  @IsString()
  @IsNotEmpty()
  MerchantRequestID!: string;

  @IsString()
  @IsNotEmpty()
  CheckoutRequestID!: string;

  @Type(() => Number)
  @IsNumber()
  ResultCode!: number;

  @IsString()
  @IsNotEmpty()
  ResultDesc!: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => MpesaCallbackMetadataDto)
  CallbackMetadata?: MpesaCallbackMetadataDto;
}

class MpesaCallbackBodyDto {
  @ValidateNested()
  @Type(() => MpesaStkCallbackDto)
  stkCallback!: MpesaStkCallbackDto;
}

export class MpesaCallbackDto {
  @ValidateNested()
  @Type(() => MpesaCallbackBodyDto)
  Body!: MpesaCallbackBodyDto;
}
