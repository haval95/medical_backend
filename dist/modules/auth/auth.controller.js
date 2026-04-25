"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateProfile = exports.removePushToken = exports.savePushToken = exports.getMe = exports.login = exports.register = void 0;
const authService = __importStar(require("./auth.service.js"));
const auth_schema_js_1 = require("./auth.schema.js");
const ApiResponse_js_1 = require("../../utils/ApiResponse.js");
const register = async (req, res, next) => {
    try {
        const body = auth_schema_js_1.registerSchema.parse(req.body);
        const result = await authService.register(body);
        res
            .status(201)
            .json(ApiResponse_js_1.ApiResponse.success('User registered successfully', result));
    }
    catch (error) {
        next(error);
    }
};
exports.register = register;
const login = async (req, res, next) => {
    try {
        const body = auth_schema_js_1.loginSchema.parse(req.body);
        const result = await authService.login(body);
        res.status(200).json(ApiResponse_js_1.ApiResponse.success('Login successful', result));
    }
    catch (error) {
        next(error);
    }
};
exports.login = login;
const getMe = async (req, res, next) => {
    try {
        const user = await authService.getMe(req.user.id);
        res.json(ApiResponse_js_1.ApiResponse.success('User profile retrieved successfully', user));
    }
    catch (error) {
        next(error);
    }
};
exports.getMe = getMe;
const savePushToken = async (req, res, next) => {
    try {
        const { token } = req.body;
        if (!token) {
            throw new Error('Push token is required');
        }
        await authService.savePushToken(req.user.id, token);
        res.json(ApiResponse_js_1.ApiResponse.success('Push token saved', null));
    }
    catch (error) {
        next(error);
    }
};
exports.savePushToken = savePushToken;
const removePushToken = async (req, res, next) => {
    try {
        await authService.removePushToken(req.user.id);
        res.json(ApiResponse_js_1.ApiResponse.success('Push token removed', null));
    }
    catch (error) {
        next(error);
    }
};
exports.removePushToken = removePushToken;
const updateProfile = async (req, res, next) => {
    try {
        const { name, phone, password } = req.body;
        const user = await authService.updateProfile(req.user.id, {
            name,
            phone,
            password,
        });
        res.json(ApiResponse_js_1.ApiResponse.success('Profile updated', user));
    }
    catch (error) {
        next(error);
    }
};
exports.updateProfile = updateProfile;
