import { createContext, useContext, useEffect, useState } from "react";
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from "firebase/auth";

import { auth, googleProvider } from "../config/firebase";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      (currentUser) => {
        setUser(currentUser);
        setLoading(false);
      },
      (error) => {
        console.error("[Firebase Auth State]", error);
        setUser(null);
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, []);

  // Google authentication is available to every user.
  // Admin authorization is handled separately by the backend MongoDB role registry.
  const loginWithGoogle = async () => {
    const result = await signInWithPopup(auth, googleProvider);

    // Update context immediately so the root route can render the dashboard
    // without waiting for the auth-state observer callback.
    setUser(result.user);

    return result.user;
  };

  const logout = async () => {
    await signOut(auth);
    setUser(null);
  };

  const value = {
    user,
    loading,
    loginWithGoogle,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return context;
};
