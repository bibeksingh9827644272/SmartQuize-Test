import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  ACCOUNTS_STORAGE_KEY,
  SESSION_STORAGE_KEY,
  createAccount,
  endSession,
  listAccounts,
  loadSessionUser,
  signIn,
  startSession,
  toAuthUser,
  updateAccountProfile,
  workspaceHasAdmin,
  type AuthUser,
  type ProfileUpdateInput,
  type RegisterInput,
  type SignInInput,
} from '../lib/auth';

interface AuthContextValue {
  user: AuthUser | null;
  accounts: AuthUser[];
  hasAdmin: boolean;
  register: (input: RegisterInput) => Promise<AuthUser>;
  login: (input: SignInInput) => Promise<AuthUser>;
  logout: () => void;
  updateProfile: (input: ProfileUpdateInput) => Promise<AuthUser>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(loadSessionUser);
  const [accounts, setAccounts] = useState<AuthUser[]>(listAccounts);
  const [hasAdmin, setHasAdmin] = useState(workspaceHasAdmin);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== ACCOUNTS_STORAGE_KEY && event.key !== SESSION_STORAGE_KEY) return;
      setUser(loadSessionUser());
      setAccounts(listAccounts());
      setHasAdmin(workspaceHasAdmin());
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const register = useCallback(async (input: RegisterInput) => {
    const account = await createAccount(input);
    const authUser = toAuthUser(account);
    setHasAdmin(workspaceHasAdmin());
    setAccounts(listAccounts());
    startSession(account.id);
    setUser(authUser);
    return authUser;
  }, []);

  const login = useCallback(async (input: SignInInput) => {
    const account = await signIn(input);
    startSession(account.id);
    const authUser = toAuthUser(account);
    setUser(authUser);
    setAccounts(listAccounts());
    setHasAdmin(workspaceHasAdmin());
    return authUser;
  }, []);

  const logout = useCallback(() => {
    endSession();
    setUser(null);
  }, []);

  const updateProfile = useCallback(
    async (input: ProfileUpdateInput) => {
      if (!user) throw new Error('Sign in again to update your profile.');
      const updated = updateAccountProfile(user.id, input);
      setUser(updated);
      setAccounts(listAccounts());
      return updated;
    },
    [user],
  );

  const value = useMemo<AuthContextValue>(
    () => ({ user, accounts, hasAdmin, register, login, logout, updateProfile }),
    [user, accounts, hasAdmin, register, login, logout, updateProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
