import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

export default function Login() {
  const { login } = useAuth();
  const [step, setStep] = useState('email'); // 'email' or 'otp'
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const handleRequestOTP = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    const API_URL = import.meta.env.VITE_API_URL ||
      (import.meta.env.MODE === 'production' ? window.location.origin : 'http://localhost:4000');

    try {
      const res = await fetch(`${API_URL}/api/auth/request-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Fehler beim Senden des OTP');
      }

      setMessage(data.message);
      setStep('otp');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (e, codeOverride = null) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const API_URL = import.meta.env.VITE_API_URL ||
      (import.meta.env.MODE === 'production' ? window.location.origin : 'http://localhost:4000');

    // Use override code if provided (for auto-submit), otherwise use state
    const codeToVerify = codeOverride || otp;

    try {
      const res = await fetch(`${API_URL}/api/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp: codeToVerify })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Ungültiger OTP-Code');
      }

      login(data.sessionToken, data.email);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    setStep('email');
    setOtp('');
    setError('');
    setMessage('');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-900 via-indigo-900 to-blue-900 p-4">
      <div className="bg-gray-800 rounded-lg shadow-2xl p-8 w-full max-w-md border border-gray-700">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Encounter Tracker</h1>
          <p className="text-gray-400">OTP-Login</p>
        </div>

        {step === 'email' ? (
          <form onSubmit={handleRequestOTP} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">
                E-Mail-Adresse
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="deine@email.com"
                disabled={loading}
              />
            </div>

            {error && (
              <div className="bg-red-900/50 border border-red-700 text-red-200 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 px-4 rounded-lg transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Sende...' : 'Login-Code anfordern'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOTP} className="space-y-4">
            <div>
              <label htmlFor="otp" className="block text-sm font-medium text-gray-300 mb-2">
                Login-Code
              </label>
              <input
                id="otp"
                type="text"
                value={otp}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                  setOtp(value);
                  // Auto-submit when 6 digits are entered
                  if (value.length === 6 && !loading) {
                    // Pass the value directly to avoid state timing issues
                    const fakeEvent = { preventDefault: () => {} };
                    handleVerifyOTP(fakeEvent, value);
                  }
                }}
                required
                maxLength={6}
                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white text-center text-2xl tracking-widest font-mono focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="000000"
                disabled={loading}
                autoFocus
              />
              <p className="text-gray-400 text-sm mt-2">
                Code wurde an <strong className="text-white">{email}</strong> gesendet
              </p>
            </div>

            {message && (
              <div className="bg-green-900/50 border border-green-700 text-green-200 px-4 py-3 rounded-lg text-sm">
                {message}
              </div>
            )}

            {error && (
              <div className="bg-red-900/50 border border-red-700 text-red-200 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <button
                type="submit"
                disabled={loading || otp.length !== 6}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 px-4 rounded-lg transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Verifiziere...' : 'Einloggen'}
              </button>

              <button
                type="button"
                onClick={handleBack}
                disabled={loading}
                className="w-full bg-gray-700 hover:bg-gray-600 text-white font-semibold py-3 px-4 rounded-lg transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Zurück
              </button>
            </div>

            <div className="text-center">
              <button
                type="button"
                onClick={handleRequestOTP}
                disabled={loading}
                className="text-purple-400 hover:text-purple-300 text-sm underline"
              >
                Code erneut senden
              </button>
            </div>
          </form>
        )}

        <div className="mt-6 pt-6 border-t border-gray-700">
          <p className="text-gray-400 text-xs text-center">
            Der Login-Code ist 10 Minuten gültig und wird per E-Mail zugestellt.
          </p>
        </div>
      </div>
    </div>
  );
}
