import { BadRequestException } from '@nestjs/common';

export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D+/g, '');

  let normalized: string;

  if (/^0\d{9}$/.test(digits)) {
    if (!/^(07\d{8}|011\d{7})$/.test(digits)) {
      throw new BadRequestException('Only Safaricom numbers are supported');
    }

    normalized = `254${digits.slice(1)}`;
  } else if (/^254\d{9}$/.test(digits)) {
    if (!/^(2547\d{8}|25411\d{7})$/.test(digits)) {
      throw new BadRequestException('Only Safaricom numbers are supported');
    }

    normalized = digits;
  } else {
    throw new BadRequestException(
      'Phone number must be a valid Kenyan Safaricom number',
    );
  }

  return normalized;
}
