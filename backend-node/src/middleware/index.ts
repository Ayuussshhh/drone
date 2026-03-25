/**
 * Middleware Index
 * Exports all middleware
 */

export {
  authenticate,
  optionalAuth,
  requireRole,
  requireAdmin,
  requireVerified,
} from './auth.middleware';

export {
  AppError,
  notFoundHandler,
  errorHandler,
  asyncHandler,
} from './error.middleware';

export {
  validate,
  registerValidation,
  loginValidation,
  emailValidation,
  passwordValidation,
  changePasswordValidation,
  componentFilterValidation,
  createComponentValidation,
  createDroneValidation,
  updateDroneValidation,
  createSimulationValidation,
  uuidParamValidation,
  paginationValidation,
} from './validation.middleware';
