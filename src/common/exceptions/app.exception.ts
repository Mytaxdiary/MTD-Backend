import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Generic application exception.
 * Use for expected business-level errors (e.g. validation failures, conflict states).
 */
export class AppException extends HttpException {
  constructor(message: string, status: HttpStatus = HttpStatus.BAD_REQUEST) {
    super({ message, statusCode: status }, status);
  }
}

/**
 * Thrown when a requested resource does not exist.
 */
export class ResourceNotFoundException extends HttpException {
  constructor(resource = 'Resource') {
    super(
      { message: `${resource} not found`, statusCode: HttpStatus.NOT_FOUND },
      HttpStatus.NOT_FOUND,
    );
  }
}

/**
 * Thrown when a request conflicts with existing state (e.g. duplicate email).
 */
export class ConflictException extends HttpException {
  constructor(message = 'Resource already exists') {
    super({ message, statusCode: HttpStatus.CONFLICT }, HttpStatus.CONFLICT);
  }
}

/**
 * Thrown when the caller is not authenticated.
 * TODO (auth phase): use this in JWT guards / auth service.
 */
export class UnauthorizedException extends HttpException {
  constructor(message = 'Unauthorized') {
    super({ message, statusCode: HttpStatus.UNAUTHORIZED }, HttpStatus.UNAUTHORIZED);
  }
}

/**
 * Thrown when the caller is authenticated but lacks permission.
 * TODO (auth phase): use this in role/permission guards.
 */
export class ForbiddenException extends HttpException {
  constructor(message = 'Access denied') {
    super({ message, statusCode: HttpStatus.FORBIDDEN }, HttpStatus.FORBIDDEN);
  }
}
