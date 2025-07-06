"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
// We keep this import so other components that use the `User` type don't break.
import type { User } from 'firebase/auth';

// This is a minimal mock user object that satisfies the User type.
// Many fields are not needed for the app to function, so we can stub them.
const mockUser: User = {
    uid: 'mock-user-123',
    displayName: 'Test User',
    email: 'test@example.com',
    photoURL: null,
    providerId: 'mock',
    emailVerified: true,
    isAnonymous: false,
    metadata: {},
    providerData: [],
    refreshToken: 'mock-token',
    tenantId: null,
    delete: async () => console.log('mock delete'),
    getIdToken: async () => 'mock-id-token',
    getIdTokenResult: async () => ({
      token: 'mock-id-token',
      expirationTime: '',
      authTime: '',
      issuedAtTime: '',
      signInProvider: null,
      signInSecondFactor: null,
      claims: {},
    }),
    reload: async () => console.log('mock reload'),
    toJSON: () => ({}),
};


const AuthContext = createContext<{
  user: User | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}>({
  user: null,
  loading: true,
  signInWithGoogle: async () => {},
  signOut: async () => {},
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Instead of using Firebase, we'll simulate a logged-in user.
  // This lets you use the app without needing real credentials.
  useEffect(() => {
    const timer = setTimeout(() => {
      setUser(mockUser);
      setLoading(false);
    }, 500); // Simulate network latency

    return () => clearTimeout(timer);
  }, []);


  const signInWithGoogle = async () => {
    console.log("Mock sign-in triggered.");
    setLoading(true);
    setTimeout(() => {
        setUser(mockUser);
        setLoading(false);
    }, 500);
  };

  const signOut = async () => {
    console.log("Mock sign-out triggered.");
    setLoading(true);
     setTimeout(() => {
        setUser(null);
        setLoading(false);
    }, 500);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
