import { ZodError } from 'zod';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
const getFirstZodMessage = (error) => {
    const firstIssue = error.issues[0];
    if (firstIssue?.message) {
        return firstIssue.message;
    }
    const flattened = error.flatten();
    const firstFieldError = Object.values(flattened.fieldErrors).find((messages) => Array.isArray(messages) && messages.length > 0)?.[0];
    return firstFieldError ?? flattened.formErrors[0] ?? 'Validation failed';
};
export const errorMiddleware = (error, _req, res, _next) => {
    if (error instanceof ApiError) {
        return res
            .status(error.statusCode)
            .json(ApiResponse.error(error.message, error.errors));
    }
    if (error instanceof ZodError) {
        const flattened = error.flatten();
        return res
            .status(400)
            .json(ApiResponse.error(getFirstZodMessage(error), flattened));
    }
    console.error(error);
    return res
        .status(500)
        .json(ApiResponse.error('An unexpected server error occurred'));
};
