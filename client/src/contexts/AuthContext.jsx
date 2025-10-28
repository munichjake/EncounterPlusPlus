import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

// API URL detection
const getApiUrl = () => {
  return import.meta.env.VITE_API_URL ||
    (import.meta.env.MODE === 'production' ? window.location.origin : 'http://localhost:4000');
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [sessionToken, setSessionToken] = useState(() => {
    return localStorage.getItem('sessionToken');
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Beim Start Session validieren
    // Versuche zunächst mit httpOnly Cookie (credentials: 'include')
    fetch(`${getApiUrl()}/api/auth/me`, {
      credentials: 'include', // Sendet httpOnly Cookie mit
      headers: sessionToken ? { 'X-Session-Token': sessionToken } : {} // Fallback für localStorage
    })
      .then(res => {
        if (!res.ok) throw new Error('Invalid session');
        return res.json();
      })
      .then(data => {
        setUser(data);
        setLoading(false);
      })
      .catch(() => {
        // Session ungültig oder nicht vorhanden
        localStorage.removeItem('sessionToken');
        setSessionToken(null);
        setUser(null);
        setLoading(false);
      });
  }, [sessionToken]);

  const login = (token, email) => {
    localStorage.setItem('sessionToken', token);
    setSessionToken(token);
    setUser({ email });
  };

  const logout = async () => {
    try {
      await fetch(`${getApiUrl()}/api/auth/logout`, {
        method: 'POST',
        credentials: 'include', // Sendet Cookie mit für logout
        headers: sessionToken ? { 'X-Session-Token': sessionToken } : {}
      });
    } catch (err) {
      console.error('Logout error:', err);
    }
    localStorage.removeItem('sessionToken');
    setSessionToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, sessionToken, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
