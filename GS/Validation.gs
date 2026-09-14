/**
 * Validation Service
 * Central validation for all user inputs to prevent injection and ensure data integrity
 * 
 * Dependencies: Utils.gs (for phone normalization)
 */

const ValidationService = {
  
  /**
   * Schema Definitions
   * Define all validation rules for each entity type
   */
  schemas: {
    order: {
      customer_name: { type: 'string', min: 2, max: 100, required: true },
      customer_phone: { type: 'phone', format: 'israeli', required: true },
      pickup_address: { type: 'string', min: 2, max: 200, required: true },
      destination_address: { type: 'string', min: 2, max: 200, required: true },
      price: { type: 'number', min: 10, max: 5000, required: true },
      pickup_notes: { type: 'string', max: 500, required: false },
      destination_notes: { type: 'string', max: 500, required: false },
      pickup_lat: { type: 'number', min: -90, max: 90, required: false },
      pickup_lng: { type: 'number', min: -180, max: 180, required: false },
      destination_lat: { type: 'number', min: -90, max: 90, required: false },
      destination_lng: { type: 'number', min: -180, max: 180, required: false }
    },
    
    driver: {
      driver_name: { type: 'string', min: 2, max: 100, required: true },
      phone: { type: 'phone', format: 'israeli', required: true },
      license_number: { type: 'string', min: 5, max: 20, required: true },
      taxi_plate_number: { type: 'string', min: 5, max: 10, required: true },
      service_area: { type: 'string', min: 2, max: 50, required: true }
    },
    
    payment: {
      order_id: { type: 'string', min: 3, max: 50, required: true },
      phone: { type: 'phone', format: 'israeli', required: true }
    }
  },
  
  /**
   * Type Validators
   * Each validator returns null if valid, or error string if invalid
   */
  validators: {
    
    string: function(value, rules) {
      if (value === null || value === undefined) {
        return rules.required ? 'This field is required' : null;
      }
      
      const str = String(value);
      
      if (rules.min && str.length < rules.min) {
        return 'Minimum ' + rules.min + ' characters required';
      }
      
      if (rules.max && str.length > rules.max) {
        return 'Maximum ' + rules.max + ' characters allowed';
      }
      
      // Check for formula injection (Google Sheets)
      if (/^[=+\-@]/.test(str)) {
        return 'Invalid format: Cannot start with formula characters';
      }
      
      // Check for script injection
      if (/<script|javascript:|onerror=/i.test(str)) {
        return 'Invalid format: Contains potentially dangerous content';
      }
      
      return null;
    },
    
    number: function(value, rules) {
      if (value === null || value === undefined || value === '') {
        return rules.required ? 'This field is required' : null;
      }
      
      const num = parseFloat(value);
      
      if (isNaN(num)) {
        return 'Must be a valid number';
      }
      
      if (rules.min !== undefined && num < rules.min) {
        return 'Minimum value is ' + rules.min;
      }
      
      if (rules.max !== undefined && num > rules.max) {
        return 'Maximum value is ' + rules.max;
      }
      
      return null;
    },
    
    phone: function(value, rules) {
      if (!value) {
        return rules.required ? 'Phone number is required' : null;
      }
      
      try {
        const normalized = Utils.normalizePhone(value);
        
        if (rules.format === 'israeli') {
          // Israeli phone: 10 digits starting with 0
          // Valid prefixes: 02, 03, 04, 08, 09 (landline), 05 (mobile)
          if (!/^0[2-9]\d{7,8}$/.test(normalized)) {
            return 'Invalid Israeli phone format. Expected: 05XXXXXXXX or 0XXXXXXXX';
          }
          
          // Mobile numbers are 10 digits (05XXXXXXXX)
          // Landline can be 9 or 10 digits
          const length = normalized.length;
          if (length !== 9 && length !== 10) {
            return 'Phone number must be 9 or 10 digits';
          }
        }
        
        return null;
      } catch (e) {
        return 'Invalid phone number format';
      }
    }
  },
  
  /**
   * Main validation function
   * @param {Object} data - The data to validate
   * @param {string} schemaName - Name of the schema to use ('order', 'driver', 'payment')
   * @returns {Object} { valid: boolean, errors: Object }
   */
  validate: function(data, schemaName) {
    const schema = this.schemas[schemaName];
    if (!schema) {
      throw new Error('Unknown schema: ' + schemaName);
    }
    
    const errors = {};
    
    // Iterate over all fields in schema
    for (const field in schema) {
      if (!schema.hasOwnProperty(field)) continue;
      
      const rules = schema[field];
      let value = data[field]; // Try snake_case first (default)

      // [FIX] Fallback to camelCase if snake_case is missing
      if (value === undefined) {
          const camelKey = field.replace(/(_\w)/g, m => m[1].toUpperCase());
          value = data[camelKey];
      }
      
      // Get the appropriate validator
      const validator = this.validators[rules.type];
      if (!validator) {
        throw new Error('Unknown validator type: ' + rules.type);
      }
      
      // Run validation
      const error = validator(value, rules);
      if (error) {
        errors[field] = error;
      }
    }
    
    return {
      valid: Object.keys(errors).length === 0,
      errors: errors
    };
  },
  
  /**
   * Quick validation for a single field
   * @param {*} value - The value to validate
   * @param {string} type - Type of validation ('string', 'number', 'phone')
   * @param {Object} rules - Validation rules
   * @returns {string|null} Error message or null if valid
   */
  validateField: function(value, type, rules) {
    const validator = this.validators[type];
    if (!validator) {
      throw new Error('Unknown validator type: ' + type);
    }
    return validator(value, rules || {});
  },
  
  /**
   * Sanitize a string value for safe storage in Google Sheets
   * @param {string} value - The value to sanitize
   * @returns {string} Sanitized value
   */
  sanitize: function(value) {
    if (!value) return '';
    
    let str = String(value).trim();
    
    // Remove formula injection
    if (/^[=+\-@]/.test(str)) {
      str = ' ' + str; // Prefix with space to neutralize
    }
    
    // Remove script tags
    str = str.replace(/<script[^>]*>.*?<\/script>/gi, '');
    str = str.replace(/javascript:/gi, '');
    str = str.replace(/onerror=/gi, '');
    
    return str;
  }
};
