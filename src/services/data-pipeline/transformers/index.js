/**
 * Built-in data transformers for pipeline
 */

/**
 * Field mapping transformer - maps fields to new names
 */
export const fieldMappingTransformer = (mappings) => async (item, context) => {
  const transformed = {};
  
  for (const [from, to] of Object.entries(mappings)) {
    if (from.includes('.')) {
      // Handle nested fields
      const value = getNestedValue(item, from);
      if (value !== undefined) {
        setNestedValue(transformed, to, value);
      }
    } else {
      if (item[from] !== undefined) {
        transformed[to] = item[from];
      }
    }
  }
  
  return transformed;
};

/**
 * Field selection transformer - selects specific fields
 */
export const fieldSelectionTransformer = (fields) => async (item, context) => {
  const selected = {};
  
  for (const field of fields) {
    if (field.includes('.')) {
      const value = getNestedValue(item, field);
      if (value !== undefined) {
        setNestedValue(selected, field, value);
      }
    } else {
      if (item[field] !== undefined) {
        selected[field] = item[field];
      }
    }
  }
  
  return selected;
};

/**
 * Field exclusion transformer - excludes specific fields
 */
export const fieldExclusionTransformer = (excludeFields) => async (item, context) => {
  const result = { ...item };
  
  for (const field of excludeFields) {
    if (field.includes('.')) {
      deleteNestedValue(result, field);
    } else {
      delete result[field];
    }
  }
  
  return result;
};

/**
 * Type conversion transformer - converts field types
 */
export const typeConversionTransformer = (conversions) => async (item, context) => {
  const converted = { ...item };
  
  for (const [field, type] of Object.entries(conversions)) {
    const value = field.includes('.') 
      ? getNestedValue(converted, field)
      : converted[field];
    
    if (value !== undefined) {
      const convertedValue = convertType(value, type);
      
      if (field.includes('.')) {
        setNestedValue(converted, field, convertedValue);
      } else {
        converted[field] = convertedValue;
      }
    }
  }
  
  return converted;
};

/**
 * JSON transformation transformer - parses/stringifies JSON fields
 */
export const jsonTransformer = (fields, operation = 'parse') => async (item, context) => {
  const transformed = { ...item };
  
  for (const field of fields) {
    const value = field.includes('.')
      ? getNestedValue(transformed, field)
      : transformed[field];
    
    if (value !== undefined) {
      try {
        const result = operation === 'parse' 
          ? JSON.parse(value)
          : JSON.stringify(value);
        
        if (field.includes('.')) {
          setNestedValue(transformed, field, result);
        } else {
          transformed[field] = result;
        }
      } catch (error) {
        // Keep original value on error
        context.logger?.warn(`JSON ${operation} failed for field ${field}:`, error.message);
      }
    }
  }
  
  return transformed;
};

/**
 * Date formatting transformer - formats date fields
 */
export const dateFormattingTransformer = (fields, format = 'ISO') => async (item, context) => {
  const transformed = { ...item };
  
  for (const field of fields) {
    const value = field.includes('.')
      ? getNestedValue(transformed, field)
      : transformed[field];
    
    if (value !== undefined) {
      const date = new Date(value);
      
      if (!isNaN(date.getTime())) {
        let formatted;
        
        switch (format) {
          case 'ISO':
            formatted = date.toISOString();
            break;
          case 'timestamp':
            formatted = date.getTime();
            break;
          case 'date':
            formatted = date.toISOString().split('T')[0];
            break;
          case 'time':
            formatted = date.toISOString().split('T')[1];
            break;
          default:
            formatted = date.toString();
        }
        
        if (field.includes('.')) {
          setNestedValue(transformed, field, formatted);
        } else {
          transformed[field] = formatted;
        }
      }
    }
  }
  
  return transformed;
};

/**
 * Aggregation transformer - aggregates array fields
 */
export const aggregationTransformer = (aggregations) => async (item, context) => {
  const transformed = { ...item };
  
  for (const [field, config] of Object.entries(aggregations)) {
    const array = field.includes('.')
      ? getNestedValue(item, field)
      : item[field];
    
    if (Array.isArray(array)) {
      let result;
      
      switch (config.operation) {
        case 'sum':
          result = array.reduce((sum, val) => sum + (Number(val) || 0), 0);
          break;
        case 'avg':
          result = array.reduce((sum, val) => sum + (Number(val) || 0), 0) / array.length;
          break;
        case 'min':
          result = Math.min(...array.map(val => Number(val) || 0));
          break;
        case 'max':
          result = Math.max(...array.map(val => Number(val) || 0));
          break;
        case 'count':
          result = array.length;
          break;
        case 'join':
          result = array.join(config.separator || ',');
          break;
        case 'unique':
          result = [...new Set(array)];
          break;
        default:
          result = array;
      }
      
      const targetField = config.targetField || `${field}_${config.operation}`;
      transformed[targetField] = result;
    }
  }
  
  return transformed;
};

/**
 * Conditional transformer - applies transformations based on conditions
 */
export const conditionalTransformer = (conditions) => async (item, context) => {
  let transformed = { ...item };
  
  for (const condition of conditions) {
    if (evaluateCondition(transformed, condition.if)) {
      if (condition.then) {
        transformed = await applyTransformation(transformed, condition.then, context);
      }
    } else if (condition.else) {
      transformed = await applyTransformation(transformed, condition.else, context);
    }
  }
  
  return transformed;
};

/**
 * Template transformer - applies template transformations
 */
export const templateTransformer = (templates) => async (item, context) => {
  const transformed = { ...item };
  
  for (const [field, template] of Object.entries(templates)) {
    transformed[field] = template.replace(/\${(\w+)}/g, (match, key) => {
      return item[key] || match;
    });
  }
  
  return transformed;
};

/**
 * Normalization transformer - normalizes values
 */
export const normalizationTransformer = (normalizations) => async (item, context) => {
  const transformed = { ...item };
  
  for (const [field, config] of Object.entries(normalizations)) {
    const value = transformed[field];
    
    if (value !== undefined) {
      let normalized = value;
      
      if (config.type === 'string') {
        normalized = String(value);
        
        if (config.lowercase) normalized = normalized.toLowerCase();
        if (config.uppercase) normalized = normalized.toUpperCase();
        if (config.trim) normalized = normalized.trim();
        if (config.replace) {
          normalized = normalized.replace(
            new RegExp(config.replace.pattern, config.replace.flags || 'g'),
            config.replace.replacement || ''
          );
        }
      } else if (config.type === 'number') {
        normalized = Number(value);
        
        if (config.min !== undefined) normalized = Math.max(normalized, config.min);
        if (config.max !== undefined) normalized = Math.min(normalized, config.max);
        if (config.round) normalized = Math.round(normalized);
        if (config.precision !== undefined) {
          normalized = Number(normalized.toFixed(config.precision));
        }
      }
      
      transformed[field] = normalized;
    }
  }
  
  return transformed;
};

// Helper functions

function getNestedValue(obj, path) {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}

function setNestedValue(obj, path, value) {
  const keys = path.split('.');
  const lastKey = keys.pop();
  const target = keys.reduce((current, key) => {
    if (!current[key]) current[key] = {};
    return current[key];
  }, obj);
  target[lastKey] = value;
}

function deleteNestedValue(obj, path) {
  const keys = path.split('.');
  const lastKey = keys.pop();
  const target = keys.reduce((current, key) => current?.[key], obj);
  if (target) delete target[lastKey];
}

function convertType(value, type) {
  switch (type) {
    case 'string':
      return String(value);
    case 'number':
      return Number(value);
    case 'boolean':
      return Boolean(value);
    case 'array':
      return Array.isArray(value) ? value : [value];
    case 'object':
      return typeof value === 'object' ? value : { value };
    default:
      return value;
  }
}

function evaluateCondition(item, condition) {
  const { field, operator, value } = condition;
  const fieldValue = field.includes('.') 
    ? getNestedValue(item, field)
    : item[field];
  
  switch (operator) {
    case 'equals':
    case '==':
      return fieldValue == value;
    case 'strictEquals':
    case '===':
      return fieldValue === value;
    case 'notEquals':
    case '!=':
      return fieldValue != value;
    case 'greaterThan':
    case '>':
      return fieldValue > value;
    case 'lessThan':
    case '<':
      return fieldValue < value;
    case 'greaterThanOrEqual':
    case '>=':
      return fieldValue >= value;
    case 'lessThanOrEqual':
    case '<=':
      return fieldValue <= value;
    case 'contains':
      return String(fieldValue).includes(value);
    case 'startsWith':
      return String(fieldValue).startsWith(value);
    case 'endsWith':
      return String(fieldValue).endsWith(value);
    case 'matches':
      return new RegExp(value).test(fieldValue);
    case 'in':
      return Array.isArray(value) && value.includes(fieldValue);
    case 'notIn':
      return Array.isArray(value) && !value.includes(fieldValue);
    case 'exists':
      return fieldValue !== undefined;
    case 'notExists':
      return fieldValue === undefined;
    default:
      return false;
  }
}

async function applyTransformation(item, transformation, context) {
  let result = { ...item };
  
  if (transformation.set) {
    for (const [field, value] of Object.entries(transformation.set)) {
      result[field] = value;
    }
  }
  
  if (transformation.unset) {
    for (const field of transformation.unset) {
      delete result[field];
    }
  }
  
  if (transformation.transform) {
    // Apply nested transformation
    result = await transformation.transform(result, context);
  }
  
  return result;
}

/**
 * Create a custom transformer
 * @param {Function} transformFn - Transformation function
 */
export const createTransformer = (transformFn) => {
  return async (item, context) => {
    return await transformFn(item, context);
  };
};

// Export all transformers
export default {
  fieldMappingTransformer,
  fieldSelectionTransformer,
  fieldExclusionTransformer,
  typeConversionTransformer,
  jsonTransformer,
  dateFormattingTransformer,
  aggregationTransformer,
  conditionalTransformer,
  templateTransformer,
  normalizationTransformer,
  createTransformer
};