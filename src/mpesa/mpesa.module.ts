import { Module } from '@nestjs/common';
import { MpesaService } from './mpesa.service';
import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [HttpModule],
  providers: [MpesaService],
  exports: [MpesaService],
})
export class MpesaModule {}
