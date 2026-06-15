import { BadGatewayException, Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { MpesaStkDto } from './dto/mpesa.dto';
import axios from 'axios';

type MpesaStkPushResponse = {
  MerchantRequestID: string;
  CheckoutRequestID: string;
  ResponseCode: string;
  ResponseDescription: string;
  CustomerMessage: string;
};

interface DarajaErrorResponse {
  errorMessage?: string;
}

@Injectable()
export class MpesaService {
  constructor(private readonly http: HttpService) {}

  private normalizePhone(phone: string) {
    // Extract digits only (removes + and non-digit characters)
    const digits = phone.replace(/\D+/g, '');

    let international254: string;

    // Domestic format: 0XXXXXXXXX (10 digits)
    if (/^0[0-9]{9}$/.test(digits)) {
      // Validate Safaricom: 07xxxxxxxx or 011xxxxxxx
      if (!/^(07[0-9]{8}|011[0-9]{7})$/.test(digits)) {
        throw new BadGatewayException('Only Safaricom numbers are supported');
      }
      // Convert: 0712345678 → 254712345678
      international254 = `254${digits.slice(1)}`;
    }
    // International format: 254XXXXXXXXX (12 digits)
    else if (/^254[0-9]{9}$/.test(digits)) {
      // Validate Safaricom: 2547xxxxxxxx or 25411xxxxxxx
      if (!/^(2547[0-9]{8}|25411[0-9]{7})$/.test(digits)) {
        throw new BadGatewayException('Only Safaricom numbers are supported');
      }
      international254 = digits;
    } else {
      throw new BadGatewayException('Only Safaricom numbers are supported');
    }

    return international254;
  }

  private generateTimestamp(): string {
    const d = new Date();
    return (
      d.getFullYear() +
      String(d.getMonth() + 1).padStart(2, '0') +
      String(d.getDate()).padStart(2, '0') +
      String(d.getHours()).padStart(2, '0') +
      String(d.getMinutes()).padStart(2, '0') +
      String(d.getSeconds()).padStart(2, '0')
    );
  }

  async generateToken(): Promise<string> {
    const key = process.env.MPESA_CONSUMER_KEY;
    const secret = process.env.MPESA_CONSUMER_SECRET;

    if (!key || !secret) {
      throw new BadGatewayException('Missing M-Pesa credentials');
    }

    const auth = Buffer.from(`${key}:${secret}`).toString('base64');

    try {
      const res = await firstValueFrom(
        this.http.get<{ access_token: string }>(
          `${process.env.MPESA_BASE_URL}/oauth/v1/generate?grant_type=client_credentials`,
          {
            headers: { Authorization: `Basic ${auth}` },
          },
        ),
      );

      return res.data.access_token;
    } catch {
      throw new BadGatewayException('Failed to generate M-Pesa token');
    }
  }

  private generatePassword() {
    const shortcode = process.env.MPESA_SHORTCODE;
    const passkey = process.env.MPESA_PASSKEY;

    if (!shortcode || !passkey) {
      throw new BadGatewayException('Missing shortcode or passkey');
    }

    const timestamp = this.generateTimestamp();
    const password = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString(
      'base64',
    );

    return { password, timestamp };
  }

  async stkPush(dto: MpesaStkDto): Promise<MpesaStkPushResponse> {
    const token = await this.generateToken();
    const { password, timestamp } = this.generatePassword();

    const baseUrl = process.env.MPESA_BASE_URL!;
    const shortcode = process.env.MPESA_SHORTCODE!;
    const callbackUrl = process.env.MPESA_CALLBACK_URL!;

    const phone = this.normalizePhone(dto.phone);

    try {
      const res = await firstValueFrom(
        this.http.post<MpesaStkPushResponse>(
          `${baseUrl}/mpesa/stkpush/v1/processrequest`,
          {
            BusinessShortCode: shortcode,
            Password: password,
            Timestamp: timestamp,
            TransactionType: 'CustomerPayBillOnline',
            Amount: dto.amount,
            PartyA: phone,
            PartyB: shortcode,
            PhoneNumber: phone,
            CallBackURL: callbackUrl,
            AccountReference: 'AkibaFlow',
            TransactionDesc: 'Goal Savings Deposit',
          },
          { headers: { Authorization: `Bearer ${token}` } },
        ),
      );

      return res.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const data = error.response?.data as DarajaErrorResponse;
        throw new BadGatewayException(data?.errorMessage ?? 'STK Push failed');
      }

      throw new BadGatewayException('STK Push failed');
    }
  }
}
