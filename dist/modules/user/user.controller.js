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
exports.bulkDelete = exports.deleteUser = exports.updateUser = exports.createUser = exports.getUser = exports.listUsers = void 0;
const userService = __importStar(require("./user.service.js"));
const ApiResponse_js_1 = require("../../utils/ApiResponse.js");
const listUsers = async (req, res, next) => {
    try {
        const users = await userService.listUsers({
            search: req.query.search,
            role: req.query.role,
            createdFrom: req.query.createdFrom,
            createdTo: req.query.createdTo,
            page: req.query.page ? Number(req.query.page) : undefined,
            limit: req.query.limit ? Number(req.query.limit) : undefined,
        });
        res.json(ApiResponse_js_1.ApiResponse.success('Users fetched', users));
    }
    catch (error) {
        next(error);
    }
};
exports.listUsers = listUsers;
const getUser = async (req, res, next) => {
    try {
        const user = await userService.getUserById(req.params.id);
        res.json(ApiResponse_js_1.ApiResponse.success('User fetched', user));
    }
    catch (error) {
        next(error);
    }
};
exports.getUser = getUser;
const createUser = async (req, res, next) => {
    try {
        const user = await userService.createUser(req.body);
        res.status(201).json(ApiResponse_js_1.ApiResponse.success('User created', user));
    }
    catch (error) {
        next(error);
    }
};
exports.createUser = createUser;
const updateUser = async (req, res, next) => {
    try {
        const user = await userService.updateUser(req.params.id, req.body);
        res.json(ApiResponse_js_1.ApiResponse.success('User updated', user));
    }
    catch (error) {
        next(error);
    }
};
exports.updateUser = updateUser;
const deleteUser = async (req, res, next) => {
    try {
        await userService.deleteUser(req.params.id);
        res.json(ApiResponse_js_1.ApiResponse.success('User deleted', { id: req.params.id }));
    }
    catch (error) {
        next(error);
    }
};
exports.deleteUser = deleteUser;
const bulkDelete = async (req, res, next) => {
    try {
        const ids = req.body?.ids || [];
        const result = await userService.bulkDeleteUsers(ids);
        res.json(ApiResponse_js_1.ApiResponse.success('Users deleted', result));
    }
    catch (error) {
        next(error);
    }
};
exports.bulkDelete = bulkDelete;
