import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api } from '../lib/api';
import { connectSocket, disconnectSocket } from '../lib/socket';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface Account {
  id: string;
  name: string;
  slug: string;
}

interface AuthState {
  user: User | null;
  account: Account | null;
  accessToken: string | null;
  refreshToken: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string, accountName: string) => Promise<void>;
  logout: () => void;
  setTokens: (accessToken: string, refreshToken: string) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      account: null,
      accessToken: null,
      refreshToken: null,

      login: async (email, password) => {
        const data: any = await api.post('/auth/login', { email, password });
        api.setToken(data.accessToken);
        connectSocket(data.accessToken);
        set({ user: data.user, account: data.account, accessToken: data.accessToken, refreshToken: data.refreshToken });
      },

      register: async (name, email, password, accountName) => {
        const data: any = await api.post('/auth/register', { name, email, password, accountName });
        api.setToken(data.accessToken);
        connectSocket(data.accessToken);
        set({ user: data.user, account: data.account, accessToken: data.accessToken, refreshToken: data.refreshToken });
      },

      logout: () => {
        const { refreshToken } = get();
        if (refreshToken) api.post('/auth/logout', { refreshToken }).catch(() => {});
        api.setToken(null);
        disconnectSocket();
        set({ user: null, account: null, accessToken: null, refreshToken: null });
      },

      setTokens: (accessToken, refreshToken) => {
        api.setToken(accessToken);
        set({ accessToken, refreshToken });
      },
    }),
    { name: 'mensageira-auth' },
  ),
);

// Restore token on load
const stored = useAuthStore.getState();
if (stored.accessToken) {
  api.setToken(stored.accessToken);
  connectSocket(stored.accessToken);
}
