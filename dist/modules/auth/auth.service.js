"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.removePushToken = exports.savePushToken = exports.updateProfile = exports.getMe = exports.login = exports.register = void 0;
const prisma_js_1 = __importDefault(require("../../utils/prisma.js"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const ApiError_js_1 = require("../../utils/ApiError.js");
const token_js_1 = require("../../utils/token.js");
const register = async (input) => {
    const existingEmail = await prisma_js_1.default.user.findUnique({
        where: { email: input.email },
    });
    if (existingEmail) {
        throw new ApiError_js_1.ApiError(400, 'Email already exists');
    }
    if (input.phone) {
        const existingPhone = await prisma_js_1.default.user.findFirst({
            where: { phone: input.phone },
        });
        if (existingPhone) {
            throw new ApiError_js_1.ApiError(400, 'Phone already exists');
        }
    }
    const hashedPassword = await bcryptjs_1.default.hash(input.password, 10);
    const user = await prisma_js_1.default.user.create({
        data: {
            email: input.email,
            password: hashedPassword,
            name: input.name,
            phone: input.phone,
            role: input.role,
        },
    });
    const token = (0, token_js_1.generateToken)(user.id, user.role);
    return {
        user: {
            id: user.id,
            email: user.email,
            name: user.name,
            phone: user.phone,
            role: user.role,
        },
        token,
    };
};
exports.register = register;
const login = async (input) => {
    const user = await prisma_js_1.default.user.findUnique({
        where: { email: input.email },
    });
    if (!user) {
        throw new ApiError_js_1.ApiError(401, 'Invalid credentials');
    }
    const isValid = await bcryptjs_1.default.compare(input.password, user.password);
    if (!isValid) {
        throw new ApiError_js_1.ApiError(401, 'Invalid credentials');
    }
    const token = (0, token_js_1.generateToken)(user.id, user.role);
    return {
        user: {
            id: user.id,
            email: user.email,
            name: user.name,
            phone: user.phone,
            role: user.role,
        },
        token,
    };
};
exports.login = login;
const getMe = async (userId) => {
    const user = await prisma_js_1.default.user.findUnique({
        where: { id: userId },
        select: {
            id: true,
            email: true,
            name: true,
            phone: true,
            role: true,
            pushToken: true,
        },
    });
    if (!user) {
        throw new ApiError_js_1.ApiError(404, 'User not found');
    }
    return user;
};
exports.getMe = getMe;
const updateProfile = async (userId, data) => {
    if (data.phone) {
        const exists = await prisma_js_1.default.user.findFirst({
            where: {
                phone: data.phone,
                id: { not: userId },
            },
        });
        if (exists) {
            throw new ApiError_js_1.ApiError(400, 'Phone number already in use');
        }
    }
    const updateData = {};
    if (data.name)
        updateData.name = data.name;
    if (data.phone)
        updateData.phone = data.phone;
    if (data.password) {
        updateData.password = await bcryptjs_1.default.hash(data.password, 10);
    }
    const user = await prisma_js_1.default.user.update({
        where: { id: userId },
        data: updateData,
        select: {
            id: true,
            email: true,
            name: true,
            phone: true,
            role: true,
            pushToken: true,
        },
    });
    return user;
};
exports.updateProfile = updateProfile;
const savePushToken = async (userId, token) => {
    await prisma_js_1.default.user.update({
        where: { id: userId },
        data: { pushToken: token },
    });
    return { success: true };
};
exports.savePushToken = savePushToken;
const removePushToken = async (userId) => {
    await prisma_js_1.default.user.update({
        where: { id: userId },
        data: { pushToken: null },
    });
    return { success: true };
};
exports.removePushToken = removePushToken;
