"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorMiddleware = void 0;
const ApiError_js_1 = require("../utils/ApiError.js");
const ApiResponse_js_1 = require("../utils/ApiResponse.js");
const zod_1 = require("zod");
const errorMiddleware = (err, req, res, next) => {
    console.error(err);
    if (err instanceof ApiError_js_1.ApiError) {
        return res
            .status(err.statusCode)
            .json(ApiResponse_js_1.ApiResponse.error(err.message, err.errors));
    }
    if (err instanceof zod_1.ZodError) {
        return res
            .status(400)
            .json(ApiResponse_js_1.ApiResponse.error('Validation Error', err.issues));
    }
    return res
        .status(500)
        .json(ApiResponse_js_1.ApiResponse.error('Internal Server Error'));
};
exports.errorMiddleware = errorMiddleware;
