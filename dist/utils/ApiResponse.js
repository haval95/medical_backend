"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApiResponse = void 0;
class ApiResponse {
    constructor(dataOrSuccess, message, data) {
        // Support both patterns:
        // new ApiResponse(data, message) - used in controllers
        // new ApiResponse(success, message, data) - used in static methods
        if (typeof dataOrSuccess === 'boolean') {
            this.success = dataOrSuccess;
            this.message = message;
            this.data = data || null;
        }
        else {
            this.success = true;
            this.message = message;
            this.data = dataOrSuccess;
        }
    }
    static success(message, data) {
        return new ApiResponse(true, message, data);
    }
    static error(message, errors = []) {
        return {
            success: false,
            message,
            errors,
        };
    }
}
exports.ApiResponse = ApiResponse;
