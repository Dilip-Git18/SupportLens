const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api';

// Get token from localStorage
export const getAuthToken = (): string | null => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('supportlens_token');
  }
  return null;
};

// Set token in localStorage
export const setAuthToken = (token: string | null) => {
  if (typeof window !== 'undefined') {
    if (token) {
      localStorage.setItem('supportlens_token', token);
    } else {
      localStorage.removeItem('supportlens_token');
      localStorage.removeItem('supportlens_user');
    }
  }
};

// Get current user from localStorage
export const getCurrentUser = (): { id: string; name: string; email: string } | null => {
  if (typeof window !== 'undefined') {
    const userStr = localStorage.getItem('supportlens_user');
    return userStr ? JSON.parse(userStr) : null;
  }
  return null;
};

// Set current user in localStorage
export const setCurrentUser = (user: { id: string; name: string; email: string } | null) => {
  if (typeof window !== 'undefined') {
    if (user) {
      localStorage.setItem('supportlens_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('supportlens_user');
    }
  }
};

// Common request wrapper
async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers || {});
  
  const token = getAuthToken();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  
  if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'Something went wrong');
  }

  return data as T;
}

// API methods
export const api = {
  // Auth
  login: async (body: any) => {
    const data = await request<{ token: string; user: { id: string; name: string; email: string } }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    setAuthToken(data.token);
    setCurrentUser(data.user);
    return data;
  },

  register: async (body: any) => {
    const data = await request<{ token: string; user: { id: string; name: string; email: string } }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    setAuthToken(data.token);
    setCurrentUser(data.user);
    return data;
  },

  getMe: async () => {
    return request<any>('/auth/me');
  },

  // Sessions
  createSession: async (body: { customerName: string; category?: string }) => {
    return request<{ session: any; inviteUrl: string; qrCodeUrl: string }>('/sessions', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  verifySession: async (token: string) => {
    return request<{ session: any }>(`/sessions/verify/${token}`);
  },

  getActiveSessions: async () => {
    return request<any[]>('/sessions/active');
  },

  getSessionHistory: async () => {
    return request<any[]>('/sessions/history');
  },

  getSessionDetails: async (token: string) => {
    return request<{ session: any; participants: any[]; messages: any[]; events: any[] }>(`/sessions/details/${token}`);
  },

  updateSessionNotes: async (token: string, body: { notes?: string; category?: string }) => {
    return request<any>(`/sessions/${token}/notes`, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  },

  endSession: async (token: string) => {
    return request<any>(`/sessions/${token}/end`, {
      method: 'POST',
    });
  },

  submitRating: async (token: string, body: { rating: number; ratingFeedback?: string }) => {
    return request<any>(`/sessions/${token}/rating`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  // Admin Dashboard
  adminGetActiveSessions: async () => {
    return request<any[]>('/sessions/admin/active');
  },

  adminTerminateSession: async (token: string) => {
    return request<any>(`/sessions/admin/terminate/${token}`, {
      method: 'POST',
    });
  },

  // File Upload
  uploadFile: async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return request<{ fileUrl: string; fileName: string; fileType: string; fileSize: number }>('/upload', {
      method: 'POST',
      body: formData,
    });
  },
};
export default api;
