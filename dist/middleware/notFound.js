"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notFound = void 0;
const ApiError_js_1 = require("../utils/ApiError.js");
const notFound = (req, res, next) => {
    next(new ApiError_js_1.ApiError(404, `Not Found - ${req.originalUrl}`));
};
exports.notFound = notFound;
