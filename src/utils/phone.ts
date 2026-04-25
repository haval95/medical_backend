import { ApiError } from './ApiError.js';

export const normalizePhoneNumber = (input: string) => {
  const sanitized = input.replace(/[^\d+]/g, '');

  if (!sanitized || sanitized.length < 8) {
    throw new ApiError(400, 'A valid phone number is required');
  }

  if (sanitized.startsWith('+')) {
    return sanitized;
  }

  return `+${sanitized}`;
};
