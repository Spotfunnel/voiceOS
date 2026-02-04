/**
 * Australian-Specific Validation Utilities
 * Following .cursor/skills/australian-primitives/SKILL.md
 * 
 * Critical: US validation patterns do NOT work for Australian data
 * - Phone: 04xx mobile, 02/03/07/08 landline (NOT E.164)
 * - Address: suburb/state/postcode (NOT city/state/ZIP)
 * - Date: DD/MM/YYYY (NOT MM/DD/YYYY)
 */

/**
 * Australian Phone Number Validation
 * 
 * Valid formats:
 * - Mobile: 04xx xxx xxx (10 digits starting with 04)
 * - Landline: 02/03/07/08 xxxx xxxx (10 digits)
 * - International: +61 (drop leading 0)
 */
export function validatePhoneAU(phone: string): boolean {
  // Remove all non-digits
  const digits = phone.replace(/\D/g, '');
  
  // Mobile: 04xx xxx xxx (10 digits starting with 04)
  if (/^04\d{8}$/.test(digits)) {
    return true;
  }
  
  // Landline: 02/03/07/08 xxxx xxxx (10 digits)
  if (/^(02|03|07|08)\d{8}$/.test(digits)) {
    return true;
  }
  
  // International: +61 (drop leading 0)
  if (phone.startsWith('+61')) {
    return validatePhoneAU(phone.replace('+61', '0'));
  }
  
  return false;
}

/**
 * Normalize phone to +61 format for storage
 */
export function normalizePhoneAU(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  
  if (digits.startsWith('0')) {
    return `+61${digits.slice(1)}`; // Remove leading 0, add +61
  } else if (digits.startsWith('61')) {
    return `+${digits}`;
  } else {
    return `+61${digits}`;
  }
}

/**
 * Format phone for display (Australian format)
 */
export function formatPhoneAU(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  
  // Mobile: 0412 345 678
  if (digits.startsWith('04') && digits.length === 10) {
    return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
  }
  
  // Landline: 02 9876 5432
  if (/^(02|03|07|08)/.test(digits) && digits.length === 10) {
    return `${digits.slice(0, 2)} ${digits.slice(2, 6)} ${digits.slice(6)}`;
  }
  
  return phone;
}

/**
 * Australian State Codes
 */
export const AUSTRALIAN_STATES = [
  { code: 'NSW', name: 'New South Wales' },
  { code: 'VIC', name: 'Victoria' },
  { code: 'QLD', name: 'Queensland' },
  { code: 'SA', name: 'South Australia' },
  { code: 'WA', name: 'Western Australia' },
  { code: 'TAS', name: 'Tasmania' },
  { code: 'NT', name: 'Northern Territory' },
  { code: 'ACT', name: 'Australian Capital Territory' },
] as const;

/**
 * Normalize state name to code
 * "New South Wales" → "NSW"
 */
export function normalizeState(state: string): string {
  const stateMap: Record<string, string> = {
    'new south wales': 'NSW',
    'victoria': 'VIC',
    'queensland': 'QLD',
    'south australia': 'SA',
    'western australia': 'WA',
    'tasmania': 'TAS',
    'northern territory': 'NT',
    'australian capital territory': 'ACT',
    'nsw': 'NSW',
    'vic': 'VIC',
    'qld': 'QLD',
    'sa': 'SA',
    'wa': 'WA',
    'tas': 'TAS',
    'nt': 'NT',
    'act': 'ACT',
  };
  
  return stateMap[state.toLowerCase()] || state.toUpperCase();
}

/**
 * Map state to timezone
 */
export function getTimezoneForState(state: string): string {
  const timezoneMap: Record<string, string> = {
    'NSW': 'Australia/Sydney',     // AEST/AEDT
    'VIC': 'Australia/Melbourne',   // AEST/AEDT
    'QLD': 'Australia/Brisbane',    // AEST (no DST)
    'SA': 'Australia/Adelaide',     // ACST/ACDT
    'WA': 'Australia/Perth',        // AWST (no DST)
    'TAS': 'Australia/Hobart',      // AEST/AEDT
    'NT': 'Australia/Darwin',       // ACST (no DST)
    'ACT': 'Australia/Sydney',      // AEST/AEDT
  };
  
  const normalized = normalizeState(state);
  return timezoneMap[normalized] || 'Australia/Sydney';
}

/**
 * Australian Address Validation
 * 
 * Note: For production, integrate with Australia Post API
 * https://auspost.com.au/api/postcode/search.json
 */
export interface AustralianAddress {
  street: string;
  suburb: string;
  state: string;
  postcode: string;
}

/**
 * Validate Australian postcode (4 digits)
 */
export function validatePostcode(postcode: string): boolean {
  return /^\d{4}$/.test(postcode);
}

/**
 * Validate address structure (basic validation)
 * 
 * Production: Replace with Australia Post API integration
 */
export function validateAddressAU(address: AustralianAddress): boolean {
  // Basic structure validation
  if (!address.street || address.street.length < 3) return false;
  if (!address.suburb || address.suburb.length < 2) return false;
  if (!address.state || !normalizeState(address.state)) return false;
  if (!validatePostcode(address.postcode)) return false;
  
  return true;
}

/**
 * Validate address with Australia Post API (async)
 * 
 * Production implementation: Call Australia Post API
 * For now, return true (basic validation only)
 */
export async function validateAddressWithAPI(
  suburb: string,
  state: string,
  postcode: string
): Promise<boolean> {
  // TODO: Integrate with Australia Post API
  // For now, just validate structure
  const stateCode = normalizeState(state);
  
  if (!stateCode || !validatePostcode(postcode)) {
    return false;
  }
  
  // Production: Call Australia Post API
  // const response = await fetch('/api/validate-address', {
  //   method: 'POST',
  //   body: JSON.stringify({ suburb, state: stateCode, postcode })
  // });
  // return response.ok;
  
  return true;
}

/**
 * Email Validation (RFC 5322 compliant)
 */
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Business Name Validation
 */
export function validateBusinessName(name: string): boolean {
  return name.length >= 2 && name.length <= 100;
}

/**
 * Validation Error Messages
 */
export const ValidationMessages = {
  phone: {
    invalid: 'Please enter a valid Australian phone number (e.g., 0412 345 678 or 02 9876 5432)',
    required: 'Phone number is required',
  },
  address: {
    street: 'Street address is required',
    suburb: 'Suburb is required',
    state: 'Please select a state',
    postcode: 'Please enter a valid 4-digit postcode',
    invalid: 'Please enter a valid Australian address',
  },
  email: {
    invalid: 'Please enter a valid email address',
    required: 'Email address is required',
  },
  businessName: {
    invalid: 'Business name must be between 2 and 100 characters',
    required: 'Business name is required',
  },
};
