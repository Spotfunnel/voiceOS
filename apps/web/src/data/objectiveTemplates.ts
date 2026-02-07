/**
 * Pre-built Objective Templates
 * Non-coders can click to add these to their workflow
 */

import type { ObjectiveTemplate } from '@/types/config';
import { PrimitiveType } from '@/types/config';

export const OBJECTIVE_TEMPLATES: ObjectiveTemplate[] = [
  {
    id: 'capture_email_au',
    name: 'Capture Email (Australian)',
    description: 'Captures a valid Australian email address with validation and confirmation',
    example: 'user@example.com.au',
    type: PrimitiveType.CAPTURE_EMAIL_AU,
    defaultPurpose: 'appointment_confirmation',
    defaultRequired: true,
    defaultMaxRetries: 3,
  },
  {
    id: 'capture_phone_au',
    name: 'Capture Phone (Australian)',
    description: 'Captures a valid Australian phone number (mobile or landline)',
    example: '+61 4XX XXX XXX or (02) XXXX XXXX',
    type: PrimitiveType.CAPTURE_PHONE_AU,
    defaultPurpose: 'callback',
    defaultRequired: true,
    defaultMaxRetries: 3,
  },
  {
    id: 'capture_address_au',
    name: 'Capture Address (Australian)',
    description: 'Captures a complete Australian address including street, suburb, state, and postcode',
    example: '123 Main Street, Sydney NSW 2000',
    type: PrimitiveType.CAPTURE_ADDRESS_AU,
    defaultPurpose: 'service_location',
    defaultRequired: true,
    defaultMaxRetries: 3,
  },
  {
    id: 'capture_service_type',
    name: 'Capture Service Type',
    description: 'Captures the type of service the customer needs',
    example: 'Plumbing, Electrical, HVAC, etc.',
    type: PrimitiveType.CAPTURE_SERVICE_TYPE,
    defaultPurpose: 'service_selection',
    defaultRequired: true,
    defaultMaxRetries: 3,
  },
  {
    id: 'capture_preferred_datetime',
    name: 'Capture Preferred Date/Time',
    description: 'Captures the customer\'s preferred date and time for service',
    example: 'Monday, February 10th at 2:00 PM',
    type: PrimitiveType.CAPTURE_PREFERRED_DATETIME,
    defaultPurpose: 'booking',
    defaultRequired: true,
    defaultMaxRetries: 3,
  },
];
