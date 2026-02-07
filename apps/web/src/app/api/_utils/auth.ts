import { NextRequest } from 'next/server';

export const getAuthHeaders = (request: NextRequest): Record<string, string> => {
  const token = request.cookies.get('session_token')?.value;
  if (!token) {
    return {};
  }
  return {
    'X-Session-Token': token,
    Authorization: `Bearer ${token}`,
  };
};
