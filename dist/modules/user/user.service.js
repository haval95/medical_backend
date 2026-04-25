"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.bulkDeleteUsers = exports.deleteUser = exports.updateUser = exports.createUser = exports.getUserById = exports.listUsers = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const prisma_js_1 = __importDefault(require("../../utils/prisma.js"));
const ApiError_js_1 = require("../../utils/ApiError.js");
const listUsers = async (params) => {
    const { search, role, createdFrom, createdTo } = params;
    const page = Math.max(1, Number(params.page) || 1);
    const limitOptions = [20, 30, 40];
    const limit = limitOptions.includes(Number(params.limit))
        ? Number(params.limit)
        : 20;
    const skip = (page - 1) * limit;
    const where = {};
    if (search) {
        where.OR = [
            { name: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
            { phone: { contains: search, mode: 'insensitive' } },
        ];
    }
    if (role) {
        where.role = role;
    }
    if (createdFrom || createdTo) {
        where.createdAt = {};
        if (createdFrom)
            where.createdAt.gte = new Date(createdFrom);
        if (createdTo) {
            const to = new Date(createdTo);
            to.setHours(23, 59, 59, 999);
            where.createdAt.lte = to;
        }
    }
    const [items, total] = await Promise.all([
        prisma_js_1.default.user.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            skip,
            take: limit,
            select: {
                id: true,
                email: true,
                name: true,
                phone: true,
                role: true,
                createdAt: true,
                updatedAt: true,
                pushToken: true,
            },
        }),
        prisma_js_1.default.user.count({ where }),
    ]);
    return {
        items,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
    };
};
exports.listUsers = listUsers;
const getUserById = async (id) => {
    const user = await prisma_js_1.default.user.findUnique({
        where: { id },
        select: {
            id: true,
            email: true,
            name: true,
            phone: true,
            role: true,
            createdAt: true,
            updatedAt: true,
            pushToken: true,
        },
    });
    if (!user)
        throw new ApiError_js_1.ApiError(404, 'User not found');
    return user;
};
exports.getUserById = getUserById;
const createUser = async (data) => {
    const existing = await prisma_js_1.default.user.findUnique({
        where: { email: data.email },
    });
    if (existing) {
        throw new ApiError_js_1.ApiError(400, 'Email already exists');
    }
    const hashedPassword = await bcryptjs_1.default.hash(data.password || 'ChangeMe123!', 10);
    const user = await prisma_js_1.default.user.create({
        data: {
            email: data.email,
            password: hashedPassword,
            name: data.name ?? '',
            phone: data.phone ?? '',
            role: data.role || 'USER',
        },
        select: {
            id: true,
            email: true,
            name: true,
            phone: true,
            role: true,
            createdAt: true,
            updatedAt: true,
        },
    });
    return user;
};
exports.createUser = createUser;
const updateUser = async (id, data) => {
    const toUpdate = {};
    if (data.name !== undefined)
        toUpdate.name = data.name;
    if (data.email !== undefined)
        toUpdate.email = data.email;
    if (data.phone !== undefined)
        toUpdate.phone = data.phone;
    if (data.role !== undefined)
        toUpdate.role = data.role;
    if (data.password) {
        toUpdate.password = await bcryptjs_1.default.hash(data.password, 10);
    }
    try {
        const user = await prisma_js_1.default.user.update({
            where: { id },
            data: toUpdate,
            select: {
                id: true,
                email: true,
                name: true,
                phone: true,
                role: true,
                createdAt: true,
                updatedAt: true,
            },
        });
        return user;
    }
    catch (err) {
        if (err.code === 'P2025')
            throw new ApiError_js_1.ApiError(404, 'User not found');
        if (err.code === 'P2002')
            throw new ApiError_js_1.ApiError(400, 'Email already exists');
        throw err;
    }
};
exports.updateUser = updateUser;
const deleteUser = async (id) => {
    try {
        await prisma_js_1.default.user.delete({ where: { id } });
        return { success: true };
    }
    catch (err) {
        if (err.code === 'P2025')
            throw new ApiError_js_1.ApiError(404, 'User not found');
        throw err;
    }
};
exports.deleteUser = deleteUser;
const bulkDeleteUsers = async (ids) => {
    if (!ids.length)
        return { deleted: 0 };
    const result = await prisma_js_1.default.user.deleteMany({
        where: { id: { in: ids } },
    });
    return { deleted: result.count };
};
exports.bulkDeleteUsers = bulkDeleteUsers;
