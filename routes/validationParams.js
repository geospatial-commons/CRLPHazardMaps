const { param, validationResult, query } = require('express-validator');

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

const validateContours = [
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

const validateBBox = [
    query(['xmin', 'xmax'])
        .isFloat({ min: 55, max: 80 })
        .withMessage('xmin and xmax must be within Afghanistan longitude range'),
    query(['ymin', 'ymax'])
        .isFloat({ min: 25, max: 42 })
        .withMessage('ymin and ymax must be within Afghanistan latitude range'),
    query().custom((_, { req }) => {
        const { xmin, xmax, ymin, ymax } = req.query;
        if (parseFloat(xmin) >= parseFloat(xmax)) {
            throw new Error('xmin must be less than xmax');
        }
        if (parseFloat(ymin) >= parseFloat(ymax)) {
            throw new Error('ymin must be less than ymax');
        }
        return true;
    })
];

// Export them exactly like your example
module.exports = {
    validateTiles,
    validateContours,
    validateProvinces,
    validateDistricts,
    validateCommunities,
    validateSearchName,
    validateSearchCode,
    validateBBox
};