/**
 * Validation Middleware
 * Request validation using express-validator
 */

import { Request, Response, NextFunction } from 'express';
import { validationResult, ValidationChain, body, param, query } from 'express-validator';

// Validation result handler
export function validate(validations: ValidationChain[]) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // Run all validations
    await Promise.all(validations.map((validation) => validation.run(req)));

    const errors = validationResult(req);

    if (errors.isEmpty()) {
      next();
      return;
    }

    res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array().map((err) => ({
        field: err.type === 'field' ? err.path : 'unknown',
        message: err.msg,
      })),
    });
  };
}

// ==================== AUTH VALIDATORS ====================

export const registerValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required'),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain uppercase, lowercase, and number'),
  body('username')
    .isLength({ min: 3, max: 30 })
    .withMessage('Username must be 3-30 characters')
    .matches(/^[a-zA-Z0-9_-]+$/)
    .withMessage('Username can only contain letters, numbers, underscores, and hyphens'),
  body('first_name')
    .optional()
    .isLength({ max: 100 })
    .withMessage('First name too long'),
  body('last_name')
    .optional()
    .isLength({ max: 100 })
    .withMessage('Last name too long'),
];

export const loginValidation = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required'),
];

export const emailValidation = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
];

export const passwordValidation = [
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain uppercase, lowercase, and number'),
];

export const changePasswordValidation = [
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword')
    .isLength({ min: 8 })
    .withMessage('New password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('New password must contain uppercase, lowercase, and number'),
];

// ==================== COMPONENT VALIDATORS ====================

export const componentFilterValidation = [
  query('type')
    .optional()
    .isIn([
      'frame', 'motor', 'propeller', 'battery', 'esc',
      'flight_controller', 'camera', 'gps', 'sensor', 'payload', 'tether',
    ])
    .withMessage('Invalid component type'),
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be 1-100'),
];

export const createComponentValidation = [
  body('name').notEmpty().withMessage('Name is required'),
  body('type')
    .isIn([
      'frame', 'motor', 'propeller', 'battery', 'esc',
      'flight_controller', 'camera', 'gps', 'sensor', 'payload', 'tether',
    ])
    .withMessage('Invalid component type'),
  body('weight_grams').isFloat({ min: 0 }).withMessage('Weight must be non-negative'),
  body('dimensions_mm').isObject().withMessage('Dimensions must be an object'),
  body('specifications').isObject().withMessage('Specifications must be an object'),
];

// ==================== DRONE VALIDATORS ====================

export const createDroneValidation = [
  body('name')
    .notEmpty()
    .withMessage('Name is required')
    .isLength({ max: 255 })
    .withMessage('Name too long'),
  body('configuration').isObject().withMessage('Configuration must be an object'),
  body('is_public').optional().isBoolean().withMessage('is_public must be boolean'),
  body('tags').optional().isArray().withMessage('Tags must be an array'),
];

export const updateDroneValidation = [
  body('name')
    .optional()
    .isLength({ max: 255 })
    .withMessage('Name too long'),
  body('configuration').optional().isObject().withMessage('Configuration must be an object'),
  body('is_public').optional().isBoolean().withMessage('is_public must be boolean'),
];

// ==================== SIMULATION VALIDATORS ====================

export const createSimulationValidation = [
  body('drone_id').isUUID().withMessage('Invalid drone ID'),
  body('simulation_type')
    .optional()
    .isIn(['flight_test', 'stress_test', 'wind_test', 'endurance_test', 'payload_test', 'tether_test'])
    .withMessage('Invalid simulation type'),
  body('environment_config').optional().isObject().withMessage('Environment config must be object'),
  body('settings').optional().isObject().withMessage('Settings must be object'),
];

// ==================== COMMON VALIDATORS ====================

export const uuidParamValidation = [
  param('id').isUUID().withMessage('Invalid ID format'),
];

export const paginationValidation = [
  query('page').optional().isInt({ min: 1 }).toInt().withMessage('Page must be positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt().withMessage('Limit must be 1-100'),
  query('sortOrder').optional().isIn(['asc', 'desc']).withMessage('Sort order must be asc or desc'),
];

export default {
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
};
