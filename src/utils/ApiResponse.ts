export class ApiResponse<T> {
  success: boolean;
  message: string;
  data: T | null;

  constructor(dataOrSuccess: T | boolean, message: string, data?: T) {
    // Support both patterns:
    // new ApiResponse(data, message) - used in controllers
    // new ApiResponse(success, message, data) - used in static methods
    if (typeof dataOrSuccess === 'boolean') {
      this.success = dataOrSuccess;
      this.message = message;
      this.data = data || null;
    } else {
      this.success = true;
      this.message = message;
      this.data = dataOrSuccess;
    }
  }

  static success<T>(message: string, data: T): ApiResponse<T> {
    return new ApiResponse(true, message, data);
  }

  static error(message: string, errors: any[] = []): any {
    return {
      success: false,
      message,
      errors,
    };
  }
}
