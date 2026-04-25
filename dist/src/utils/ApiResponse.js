export const ApiResponse = {
    success(message, data) {
        return {
            success: true,
            message,
            data,
        };
    },
    error(message, errors) {
        return {
            success: false,
            message,
            errors,
        };
    },
};
