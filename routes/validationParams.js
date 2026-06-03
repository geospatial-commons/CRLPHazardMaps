const { param, validationResult, query, body } = require('express-validator');

// Reusable middleware to catch validation errors
const validateRequest = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    next();
};

// Map Tile Validations
const validateTiles = [
    param('layer').isString().matches(/^[a-zA-Z0-9_-]+$/).withMessage('Invalid layer name'),
    param(['z', 'x', 'y']).isInt({ min: 0 }).toInt().withMessage('Coordinate must be a non-negative integer'),
    validateRequest
];

const validateVectorTiles = [
    param(['z', 'x', 'y']).isInt({ min: 0 }).toInt().withMessage('Coordinate must be a non-negative integer'),
    validateRequest
];

// API Validations
const validateProvinces = [
    param('quality')
        .trim()
        .toLowerCase()
        .isIn(['0', '1', 'simplified', 'detailed'])
        .withMessage('Invalid quality parameter'),
    validateRequest
];

const validateDistricts = [
    param('provId')
        .trim()
        .matches(/^[a-zA-Z0-9_-]{1,50}$/)
        .withMessage('Invalid Province ID format'),
    validateRequest
];

const validateCommunities = [
    param('distId')
        .trim()
        .matches(/^[a-zA-Z0-9_-]{1,50}$/)
        .withMessage('Invalid District ID format'),
    validateRequest
];

const validateSearchName = [
    query('q')
        .trim()
        .isLength({ min: 2, max: 100 })
        .withMessage('Search name must be between 2 and 100 characters')
        .escape(),
    validateRequest
];

const validateSearchCode = [
    query('q')
        .trim()
        .isLength({ min: 2, max: 20 }) // Recommended: searching for 1 character with %?% is very slow
        .matches(/^[a-zA-Z0-9-]+$/)
        .withMessage('Invalid characters in search'),
    validateRequest
];

const validateMapCreationAnalytics = [
    body('hazard')
        .optional({ nullable: true, checkFalsy: true })
        .trim()
        .isLength({ max: 100 })
        .withMessage('hazard must be at most 100 characters'),

    body('Pcode')
        .optional({ nullable: true, checkFalsy: true })
        .trim()
        .matches(/^[a-zA-Z0-9_-]{1,50}$/)
        .withMessage('Invalid Pcode format'),

    body('province_code')
        .optional({ nullable: true, checkFalsy: true })
        .trim()
        .matches(/^[a-zA-Z0-9_-]{1,50}$/)
        .withMessage('Invalid province_code format'),

    body('community_name')
        .optional({ nullable: true, checkFalsy: true })
        .trim()
        .isLength({ max: 200 })
        .withMessage('community_name must be at most 200 characters'),

    body('arazi_code')
        .optional({ nullable: true, checkFalsy: true })
        .isInt({ min: 0 })
        .withMessage('arazi_code must be a non-negative integer')
        .toInt(),

    body('UNOPS_Code')
        .optional({ nullable: true, checkFalsy: true })
        .trim()
        .matches(/^\d{2}-\d{4}-R\d{4}$/)
        .withMessage('UNOPS_Code must follow the format 09-0908-R0001'),

    body('IOM_Code')
        .optional({ nullable: true, checkFalsy: true })
        .trim()
        .matches(/^AF\d{10,}$/)
        .withMessage('IOM_Code must follow the format AF3405086116'),

    body('request_type')
        .exists({ checkFalsy: false })
        .withMessage('request_type is required')
        .isInt({ min: 0 })
        .withMessage('request_type must be a non-negative integer')
        .toInt(),

    validateRequest
];

const validateLogin = [
    body('email')
        .trim()
        .notEmpty().withMessage('Email is required')
        .isEmail().withMessage('Must be a valid email address')
        .normalizeEmail(), // Cleans up the email (e.g., lowercase, removes dots in Gmail if configured)

    body('password')
        .notEmpty().withMessage('Password is required')
        .isLength({ min: 8 }).withMessage('Password must be at least 8 characters long'),
        // Optional: .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).withMessage('Password must contain an uppercase letter, lowercase letter, and a number')

    validateRequest
];


// Custom Community Validations
const validateCreateCommunity = [
    body('lat')
        .exists().withMessage('Latitude is required')
        .isFloat({ min: -90, max: 90 }).withMessage('Latitude must be between -90 and 90')
        .toFloat(),
        
    body('lon')
        .exists().withMessage('Longitude is required')
        .isFloat({ min: -180, max: 180 }).withMessage('Longitude must be between -180 and 180')
        .toFloat(),
        
    body('name')
        .exists().withMessage('Please provide a community name')
        .trim()
        .isLength({ max: 250 }).withMessage('Name cannot exceed 250 characters')
        .escape(),

    validateRequest
];

const validateDeleteCommunity = [
    body('crlp_community_id')
        .trim()
        .notEmpty().withMessage('crlp_community_id is required'),
        //.isUUID().withMessage('Invalid ID format'),

    validateRequest
];

const validateUpdateCommunity = [
    body('crlp_community_id')
        .optional({ values: 'falsy' })
        .trim(),
        //.isUUID().withMessage('Invalid crlp_community_id format'),

    body('pk_id')
        .optional({ values: 'falsy' })
        .trim()
        .isLength({ max: 50 }).withMessage('Existing ID is too long'),

    body('lat')
        .exists().withMessage('Latitude is required')
        .isFloat({ min: -90, max: 90 }).withMessage('Latitude must be between -90 and 90')
        .toFloat(),
        
    body('lon')
        .exists().withMessage('Longitude is required')
        .isFloat({ min: -180, max: 180 }).withMessage('Longitude must be between -180 and 180')
        .toFloat(),
        
    body('name')
        .optional({ values: 'falsy' })
        .trim()
        .isLength({ max: 250 }).withMessage('Name cannot exceed 250 characters')
        .escape(),

    validateRequest
];

// Export them exactly like your example
module.exports = {
    validateTiles,
    validateVectorTiles,
    validateProvinces,
    validateDistricts,
    validateCommunities,
    validateSearchName,
    validateSearchCode,
    validateMapCreationAnalytics,
    validateLogin,
    validateCreateCommunity,
    validateDeleteCommunity,
    validateUpdateCommunity
};