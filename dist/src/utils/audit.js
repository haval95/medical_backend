import { Prisma } from '@prisma/client';
const auditReplacer = (_key, value) => {
    if (value instanceof Date) {
        return value.toISOString();
    }
    if (typeof value === 'bigint') {
        return value.toString();
    }
    return value;
};
export const toAuditJson = (value) => {
    if (value === undefined) {
        return undefined;
    }
    const serialized = JSON.parse(JSON.stringify(value, auditReplacer));
    if (serialized === null) {
        return Prisma.JsonNull;
    }
    return serialized;
};
export const extractEntityId = (value) => {
    if (!value || typeof value !== 'object') {
        return undefined;
    }
    if ('id' in value && typeof value.id === 'string') {
        return value.id;
    }
    const entries = Object.values(value);
    for (const entry of entries) {
        const nestedId = extractEntityId(entry);
        if (nestedId) {
            return nestedId;
        }
    }
    return undefined;
};
