const Joi = require('joi');
const logger = require('../../../../shared/utils/logger');

const passwordSchema = Joi.string()
  .min(8)
  .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&]).+$/)
  .required()
  .messages({
    'string.min': 'Password must be at least 8 characters long',
    'string.pattern.base': 'Password must include uppercase, lowercase, number, and special character (@$!%*?&)',
    'any.required': 'Password is required'
  });

/**
 * Validate registration data
 */
const validateRegister = (req, res, next) => {
  const schema = Joi.object({
    email: Joi.string().email().required().messages({
      'string.email': 'Please provide a valid email address',
      'any.required': 'Email is required'
    }),
    password: passwordSchema,
    role: Joi.string()
      .valid('patient', 'doctor', 'admin', 'insurance')
      .default('patient')
      .messages({
        'any.only': 'Role must be one of: patient, doctor, admin, insurance'
      }),
    fullName: Joi.string().optional().trim(),
    walletAddress: Joi.string()
      .pattern(/^0x[a-fA-F0-9]{40}$/)
      .optional()
      .messages({
        'string.pattern.base': 'Invalid Ethereum wallet address format'
      }),
  });

  const { error, value } = schema.validate(req.body, { abortEarly: false });

  if (error) {
    const errorMessages = error.details.map(detail => detail.message);
    logger.error('Validation error:', errorMessages);

    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errorMessages
    });
  }

  req.body = value;
  next();
};

/**
 * Validate login request
 */
const validateLogin = (req, res, next) => {
  const schema = Joi.object({
    email: Joi.string().email().required().messages({
      'string.email': 'Please provide a valid email address',
      'any.required': 'Email is required'
    }),
    password: Joi.string().required().messages({
      'any.required': 'Password is required'
    }),
  });

  const { error, value } = schema.validate(req.body);

  if (error) {
    logger.error('Validation error:', error.details[0].message);
    return res.status(400).json({
      success: false,
      message: error.details[0].message
    });
  }

  req.body = value;
  next();
};

/**
 * Validate OTP verification
 */
const validateOTP = (req, res, next) => {
  const schema = Joi.object({
    email: Joi.string().email().required().messages({
      'string.email': 'Please provide a valid email address',
      'any.required': 'Email is required'
    }),
    otp: Joi.string()
      .length(6)
      .pattern(/^[0-9]+$/)
      .required()
      .messages({
        'string.length': 'OTP must be exactly 6 digits',
        'string.pattern.base': 'OTP must contain only numbers',
        'any.required': 'OTP is required'
      }),
  });

  const { error, value } = schema.validate(req.body);

  if (error) {
    logger.error('Validation error:', error.details[0].message);
    return res.status(400).json({
      success: false,
      message: error.details[0].message
    });
  }

  req.body = value;
  next();
};

/**
 * Validate password change request
 */
const validateChangePassword = (req, res, next) => {
  const schema = Joi.object({
    currentPassword: Joi.string().required().messages({
      'any.required': 'Current password is required'
    }),
    newPassword: passwordSchema.messages({
      'string.min': 'New password must be at least 8 characters long',
      'string.pattern.base': 'New password must include uppercase, lowercase, number, and special character (@$!%*?&)',
      'any.required': 'New password is required'
    }),
  });

  const { error, value } = schema.validate(req.body);

  if (error) {
    logger.error('Validation error:', error.details[0].message);
    return res.status(400).json({
      success: false,
      message: error.details[0].message
    });
  }

  req.body = value;
  next();
};

module.exports = {
  passwordSchema,
  validateRegister,
  validateLogin,
  validateOTP,
  validateChangePassword,
};
