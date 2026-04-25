import { Prisma } from '@prisma/client';

const auditReplacer = (_key: string, value: unknown) => {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === 'bigint') {
    return value.toString();
  }

  return value;
};

export const toAuditJson = (value: unknown) => {
  if (value === undefined) {
    return undefined;
  }

  const serialized = JSON.parse(JSON.stringify(value, auditReplacer)) as unknown;

  if (serialized === null) {
    return Prisma.JsonNull;
  }

  return serialized as Prisma.InputJsonValue;
};

export const extractEntityId = (value: unknown): string | undefined => {
  if (!value || typeof value !== 'object') {
    return undefined;
  }

  if ('id' in value && typeof (value as { id?: unknown }).id === 'string') {
    return (value as { id: string }).id;
  }

  const entries = Object.values(value as Record<string, unknown>);

  for (const entry of entries) {
    const nestedId = extractEntityId(entry);

    if (nestedId) {
      return nestedId;
    }
  }

  return undefined;
};
