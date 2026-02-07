import { createContext, useContext, ReactNode } from 'react';

interface AuthContextType {
  user: null;
  session: null;
  loading: boolean;
  isAdmin: boolean;
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const signUp = async (_email: string, _password: string) => {
    return { error: new Error('Authentication not implemented') };
  };

  const signIn = async (_email: string, _password: string) => {
    return { error: new Error('Authentication not implemented') };
  };

  const signOut = async () => {
    // No-op
  };

  return (
    <AuthContext.Provider value={{ 
      user: null, 
      session: null, 
      loading: false, 
      isAdmin: false, 
      signUp, 
      signIn, 
      signOut 
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
