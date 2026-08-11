export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown;

  public constructor(statusCode: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export class UnauthorizedError extends AppError {
  public constructor(message = '登录状态已失效，请重新登录。') {
    super(401, 'UNAUTHENTICATED', message);
  }
}

export class NotFoundError extends AppError {
  public constructor(message = '没有找到请求的内容。') {
    super(404, 'NOT_FOUND', message);
  }
}

export class ConflictError extends AppError {
  public constructor(message: string, details?: unknown) {
    super(409, 'VERSION_CONFLICT', message, details);
  }
}
