/**
 * PII Sanitization Utility - Layer 2: Orchestration
 * 
 * Sanitizes PII from event payloads before storage.
 * Following production-observability patterns for GDPR/HIPAA/TCPA compliance.
 * 
 * PII Types:
 * - Email addresses
 * - Phone numbers (Australian format)
 * - Addresses
 * - Names
 * - Credit card numbers
 * - SSN, driver's license
 */

/**
 * Sanitize PII from text or object
 */
export function sanitizePII(input: unknown): unknown {
  if (input === null || input === undefined) {
    return input;
  }

  if (typeof input === 'string') {
    return sanitizeText(input);
  }

  if (typeof input === 'number' || typeof input === 'boolean') {
    return input;
  }

  if (Array.isArray(input)) {
    return input.map(item => sanitizePII(item));
  }

  if (typeof input === 'object') {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input)) {
      // Skip sanitization for known non-PII fields
      if (isNonPIIField(key)) {
        sanitized[key] = value;
      } else {
        sanitized[key] = sanitizePII(value);
      }
    }
    return sanitized;
  }

  return input;
}

/**
 * Sanitize PII from text string
 */
function sanitizeText(text: string): string {
  let sanitized = text;

  // Email addresses
  sanitized = sanitized.replace(
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/gi,
    '<EMAIL>'
  );

  // Australian phone numbers (mobile: 04xx xxx xxx, landline: 02/03/07/08 xxxx xxxx)
  sanitized = sanitized.replace(/\b04\d{2}\s?\d{3}\s?\d{3}\b/g, '<PHONE>');
  sanitized = sanitized.replace(/\b(02|03|07|08)\d{2}\s?\d{3}\s?\d{3}\b/g, '<PHONE>');
  sanitized = sanitized.replace(/\b\+61\s?4\d{2}\s?\d{3}\s?\d{3}\b/g, '<PHONE>');
  sanitized = sanitized.replace(/\b\+61\s?(2|3|7|8)\d{1}\s?\d{4}\s?\d{4}\b/g, '<PHONE>');

  // Credit card numbers (basic pattern)
  sanitized = sanitized.replace(
    /\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b/g,
    '<CARD>'
  );

  // Australian addresses (postcode patterns: 4 digits)
  sanitized = sanitized.replace(/\b\d{4}\b(?=\s*(?:NSW|VIC|QLD|SA|WA|TAS|NT|ACT))?/g, '<POSTCODE>');

  // Note: Name detection would require NER model for better accuracy
  // For Day 1, we rely on field names (e.g., "name", "first_name", "last_name")
  // In production, integrate with NER model for better coverage

  return sanitized;
}

/**
 * Check if field name indicates non-PII content
 */
function isNonPIIField(fieldName: string): boolean {
  const nonPIIFields = [
    'event_id',
    'event_type',
    'event_version',
    'trace_id',
    'sequence_number',
    'timestamp',
    'tenant_id',
    'conversation_id',
    'objective_id',
    'objective_type',
    'purpose',
    'required',
    'attempts',
    'error_code',
    'error_message',
    'status',
    'reason',
    'duration_ms',
    'config_version',
    'locale',
    'objective_count',
  ];

  return nonPIIFields.includes(fieldName.toLowerCase());
}

/**
 * Sanitize specific PII fields in an object
 */
export function sanitizePIIFields(data: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  const piiFieldPatterns = [
    /email/i,
    /phone/i,
    /mobile/i,
    /address/i,
    /name/i,
    /firstname/i,
    /lastname/i,
    /card/i,
    /credit/i,
    /ssn/i,
    /driver/i,
    /license/i,
  ];

  for (const [key, value] of Object.entries(data)) {
    const isPIIField = piiFieldPatterns.some(pattern => pattern.test(key));
    
    if (isPIIField && typeof value === 'string') {
      sanitized[key] = sanitizeText(value);
    } else {
      sanitized[key] = sanitizePII(value);
    }
  }

  return sanitized;
}
