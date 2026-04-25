"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authorize = exports.authenticate = void 0;
const token_js_1 = require("../utils/token.js");
const ApiError_js_1 = require("../utils/ApiError.js");
const authenticate = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return next(new ApiError_js_1.ApiError(401, 'Unauthorized - No token provided'));
    }
    const token = authHeader.split(' ')[1];
    try {
        const decoded = (0, token_js_1.verifyToken)(token);
        const appHeader = (req.headers['x-app'] || req.headers['x-app-context']);
        if (decoded.app && appHeader && decoded.app !== appHeader) {
            return next(new ApiError_js_1.ApiError(403, 'Forbidden - Wrong application context'));
        }
        req.user = decoded;
        next();
    }
    catch (error) {
        next(new ApiError_js_1.ApiError(401, 'Unauthorized - Invalid token'));
    }
};
exports.authenticate = authenticate;
const authorize = (roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return next(new ApiError_js_1.ApiError(401, 'Unauthorized - User not authenticated'));
        }
        if (!roles.includes(req.user.role)) {
            return next(new ApiError_js_1.ApiError(403, 'Forbidden - Insufficient permissions'));
        }
        next();
    };
};
exports.authorize = authorize;
