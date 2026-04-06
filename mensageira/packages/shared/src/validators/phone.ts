import { z } from 'zod';

const PHONE_REGEX = /^\+?[1-9]\d{6,14}$/;

export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (!digits.startsWith('55') && digits.length <= 11) {
    return `55${digits}`;
  }
  return digits;
}

export const phoneSchema = z
  .string()
  .min(8)
  .max(20)
  .transform(normalizePhone)
  .refine((val) => PHONE_REGEX.test(val), {
    message: 'Invalid phone number format',
  });
