import { Prisma } from '@prisma/client';

export const money = (
  value: Prisma.Decimal | number | string,
): Prisma.Decimal => new Prisma.Decimal(value);

export const percentage = (
  current: Prisma.Decimal,
  target: Prisma.Decimal,
): number => {
  if (target.isZero()) {
    return 0;
  }
  return Math.min(current.div(target).mul(100).floor().toNumber(), 100);
};
