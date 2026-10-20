const { badRequest } = require('../utils/ApiError');

/**
 * Tiny declarative validator.
 *
 *   validate([
 *     { field: 'email', type: 'email', required: true },
 *     { field: 'max_days', type: 'int', required: true, min: 1, max: 60 },
 *   ])
 *
 * Supported types: string, email, int, date, enum, boolean, image.
 * Values are trimmed / coerced and written back to req.body (or req[source]).
 * On failure responds 400 with { success:false, message, errors:{field:msg} }.
 */
const isValidDate = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validate(rules, source = 'body') {
  return (req, res, next) => {
    const input = req[source] || {};
    const output = {};
    const errors = {};

    for (const rule of rules) {
      const { field, type = 'string', required = false } = rule;
      const label = rule.label || field;
      let value = input[field];

      if (typeof value === 'string') value = value.trim();

      const absent = value === undefined || value === null || value === '';

      if (absent) {
        if (required) {
          errors[field] = `${label} is required`;
        } else if (value === '' && ['string', 'image'].includes(type)) {
          output[field] = ''; // allows clearing optional text fields
        }
        continue;
      }

      switch (type) {
        case 'string':
        case 'email': {
          if (typeof value !== 'string') {
            errors[field] = `${label} must be text`;
            break;
          }
          if (type === 'email' && !EMAIL_RE.test(value)) {
            errors[field] = `${label} must be a valid email address`;
            break;
          }
          if (rule.minLength && value.length < rule.minLength) {
            errors[field] = `${label} must be at least ${rule.minLength} characters`;
            break;
          }
          if (rule.maxLength && value.length > rule.maxLength) {
            errors[field] = `${label} must be at most ${rule.maxLength} characters`;
            break;
          }
          output[field] = type === 'email' ? value.toLowerCase() : value;
          break;
        }
        case 'int': {
          const n = Number(value);
          if (!Number.isInteger(n)) {
            errors[field] = `${label} must be a whole number`;
            break;
          }
          if (rule.min !== undefined && n < rule.min) {
            errors[field] = `${label} must be at least ${rule.min}`;
            break;
          }
          if (rule.max !== undefined && n > rule.max) {
            errors[field] = `${label} must be at most ${rule.max}`;
            break;
          }
          output[field] = n;
          break;
        }
        case 'date': {
          if (typeof value !== 'string' || !isValidDate(value)) {
            errors[field] = `${label} must be a valid date (YYYY-MM-DD)`;
            break;
          }
          output[field] = value;
          break;
        }
        case 'enum': {
          if (!rule.values.includes(value)) {
            errors[field] = `${label} must be one of: ${rule.values.join(', ')}`;
            break;
          }
          output[field] = value;
          break;
        }
        case 'boolean': {
          if (value === true || value === 'true' || value === '1') output[field] = true;
          else if (value === false || value === 'false' || value === '0') output[field] = false;
          else errors[field] = `${label} must be true or false`;
          break;
        }
        case 'image': {
          // external http(s) URL or a path produced by our own upload endpoint
          if (typeof value !== 'string' || value.length > 500) {
            errors[field] = `${label} is too long`;
            break;
          }
          if (!/^https?:\/\/\S+$/i.test(value) && !/^\/uploads\/[\w.-]+$/.test(value)) {
            errors[field] = `${label} must be a valid http(s) URL`;
            break;
          }
          output[field] = value;
          break;
        }
        default:
          output[field] = value;
      }
    }

    if (Object.keys(errors).length) {
      return next(badRequest('Validation failed: ' + Object.values(errors)[0], errors));
    }

    // Keep any untouched keys, overwrite validated ones.
    req[source] = { ...input, ...output };
    next();
  };
}

module.exports = { validate, isValidDate };
