const BASE_URL = 'http://localhost:5000/api/v1';

export interface User {
  id: string;
  email: string;
  role: 'student' | 'faculty' | 'hostel_superintendent' | 'conference_supervisor' | 'gate_security' | 'admin';
  name: string;
}

export function getToken(): string | null {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('gatepass_token');
  }
  return null;
}

export function setToken(token: string) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('gatepass_token', token);
  }
}

export function getUser(): User | null {
  if (typeof window !== 'undefined') {
    const userStr = localStorage.getItem('gatepass_user');
    if (userStr) {
      try {
        return JSON.parse(userStr);
      } catch {
        return null;
      }
    }
  }
  return null;
}

export function setUser(user: User | null) {
  if (typeof window !== 'undefined') {
    if (user) {
      localStorage.setItem('gatepass_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('gatepass_user');
      localStorage.removeItem('gatepass_token');
    }
  }
}

async function request(endpoint: string, options: RequestInit = {}) {
  const token = getToken();
  const headers = new Headers(options.headers || {});
  
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  
  if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error || `HTTP error! status: ${response.status}`);
  }

  return response.json();
}

export const api = {
  // Auth
  async login(credentials: { email: string; password: string }) {
    const data = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
    setToken(data.accessToken);
    setUser(data.user);
    return data;
  },

  async seed() {
    return request('/auth/seed', { method: 'POST' });
  },

  // Passes
  async getPasses(filters: { status?: string; type?: string } = {}) {
    const params = new URLSearchParams();
    if (filters.status) params.append('status', filters.status);
    if (filters.type) params.append('type', filters.type);
    
    const query = params.toString() ? `?${params.toString()}` : '';
    return request(`/passes${query}`);
  },

  async createPass(passData: { passType: string; startDate: string; endDate: string; passDetails: any }) {
    return request('/passes', {
      method: 'POST',
      body: JSON.stringify(passData),
    });
  },

  async updatePassStatus(passId: string, payload: { status: 'approved' | 'rejected'; comments?: string }) {
    return request(`/passes/${passId}/status`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  // Verification
  async generateQRPayload(passId: string) {
    return request(`/verification/qr/generate/${passId}`);
  },

  async verifyQRPayload(payload: string) {
    return request('/verification/qr/verify', {
      method: 'POST',
      body: JSON.stringify({ payload }),
    });
  },

  async simulateRFID(rfidTag: string) {
    return request('/verification/rfid/simulate', {
      method: 'POST',
      body: JSON.stringify({ rfidTag }),
    });
  },

  // SWD Integration
  async getSWDStudent(rollNumber: string, apiKey: string) {
    return request(`/integration/swd/student/${rollNumber}`, {
      headers: { 'x-api-key': apiKey }
    });
  },

  async syncSWDStudentStatus(payload: { rollNumber: string; isBlacklisted: boolean }, apiKey: string) {
    return request('/integration/swd/sync-status', {
      method: 'POST',
      headers: { 'x-api-key': apiKey },
      body: JSON.stringify(payload),
    });
  }
};
