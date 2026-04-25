import { PrismaClient } from '@prisma/client';
import { extractEntityId, toAuditJson } from '../utils/audit.js';
import { getRequestContext } from '../utils/requestContext.js';
const globalForPrisma = globalThis;
const basePrisma = globalForPrisma.prisma ??
    new PrismaClient({
        log: ['error', 'warn'],
    });
const auditedOperations = new Set([
    'create',
    'createMany',
    'update',
    'updateMany',
    'upsert',
    'delete',
    'deleteMany',
]);
const getModelDelegate = (model) => basePrisma[`${model.charAt(0).toLowerCase()}${model.slice(1)}`];
const readBeforeSnapshot = async (model, where) => {
    if (!where) {
        return undefined;
    }
    const delegate = getModelDelegate(model);
    if (!delegate?.findUnique) {
        return undefined;
    }
    try {
        return await delegate.findUnique({ where });
    }
    catch {
        return undefined;
    }
};
export const prisma = basePrisma.$extends({
    query: {
        $allModels: {
            async $allOperations({ model, operation, args, query }) {
                if (!model || model === 'AuditLog' || !auditedOperations.has(operation)) {
                    return query(args);
                }
                const where = args?.where;
                const before = operation === 'update' || operation === 'upsert' || operation === 'delete'
                    ? await readBeforeSnapshot(model, where)
                    : undefined;
                const result = await query(args);
                const context = getRequestContext();
                try {
                    await basePrisma.auditLog.create({
                        data: {
                            actorUserId: context?.actor?.userId,
                            actorRole: context?.actor?.role,
                            action: operation.toUpperCase(),
                            entityType: model,
                            entityId: extractEntityId(result) ?? extractEntityId(where),
                            ipAddress: context?.ipAddress,
                            userAgent: context?.userAgent,
                            before: toAuditJson(before),
                            after: toAuditJson(result),
                            metadata: toAuditJson({
                                model,
                                operation,
                                where,
                            }),
                        },
                    });
                }
                catch (error) {
                    console.error('Audit log write failed', error);
                }
                return result;
            },
        },
    },
});
if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = basePrisma;
}
