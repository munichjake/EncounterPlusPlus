import React, { useState, useEffect } from 'react';
import { apiPost, apiDelete } from '../utils/api.js';

/**
 * ShareCodeModal - Shows a QR code and share code for mobile app access
 * @param {string} encounterId - The encounter ID to generate share code for
 * @param {function} onClose - Callback when modal is closed
 */
export function ShareCodeModal({ encounterId, onClose }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [shareData, setShareData] = useState(null);
  const [showRegenerateConfirm, setShowRegenerateConfirm] = useState(false);
  const [showRevokeConfirm, setShowRevokeConfirm] = useState(false);

  useEffect(() => {
    generateShareCode();
  }, [encounterId]);

  const generateShareCode = async (forceNew = false) => {
    setLoading(true);
    setError(null);

    try {
      const url = forceNew
        ? `/api/encounters/${encounterId}/share-code?forceNew=true`
        : `/api/encounters/${encounterId}/share-code`;
      const response = await apiPost(url);
      const data = await response.json();
      setShareData(data);
    } catch (err) {
      console.error('Failed to generate share code:', err);
      setError('Failed to generate share code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const regenerateShareCode = async () => {
    setShowRegenerateConfirm(false);
    await generateShareCode(true);
  };

  const revokeShareCode = async () => {
    setShowRevokeConfirm(false);

    try {
      await apiDelete(`/api/encounters/${encounterId}/share-code`);
      onClose();
    } catch (err) {
      console.error('Failed to revoke share code:', err);
      setError('Failed to revoke share code.');
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    alert('Copied to clipboard!');
  };

  const formatExpiryTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = timestamp - now.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    if (diffHours > 0) {
      return `${diffHours}h ${diffMinutes}m`;
    }
    return `${diffMinutes}m`;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="relative bg-slate-800 rounded-lg shadow-2xl max-w-lg w-full p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-white">Share Encounter</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4"></div>
            <p className="text-slate-400">Generating share code...</p>
          </div>
        ) : error ? (
          <div className="bg-red-900/20 border border-red-500 rounded p-4 mb-4">
            <p className="text-red-400">{error}</p>
            <button
              onClick={generateShareCode}
              className="mt-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded"
            >
              Retry
            </button>
          </div>
        ) : shareData ? (
          <div className="space-y-6">
            {/* QR Code */}
            <div className="bg-white rounded-lg p-4 flex items-center justify-center">
              <img
                src={shareData.qrCode}
                alt="QR Code"
                className="w-64 h-64"
              />
            </div>

            {/* Share Code */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Share Code
              </label>
              <div className="flex gap-3 items-center">
                <input
                  type="text"
                  value={shareData.shareCode}
                  readOnly
                  className="flex-1 min-w-0 px-4 py-3 bg-slate-700 border border-slate-600 rounded text-white text-center text-3xl font-mono tracking-widest"
                  maxLength={4}
                />
                <button
                  onClick={() => copyToClipboard(shareData.shareCode)}
                  className="flex-shrink-0 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                  title="Copy to clipboard"
                >
                  📋
                </button>
              </div>
            </div>

            {/* Instructions */}
            <div className="bg-slate-700/50 rounded p-4 text-sm text-slate-300">
              <p className="font-semibold mb-2">📱 How to connect:</p>
              <ol className="list-decimal list-inside space-y-1">
                <li>Open the Encounter++ mobile app</li>
                <li>Scan the QR code or enter the 4-digit code</li>
                <li>The player view will automatically sync</li>
              </ol>
            </div>

            {/* Expiry Info and Actions */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">
                  Expires in: <span className="text-white font-semibold">
                    {formatExpiryTime(shareData.expiresAt)}
                  </span>
                </span>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2">
                <button
                  onClick={() => setShowRegenerateConfirm(true)}
                  className="flex-1 px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded font-medium"
                  disabled={loading}
                >
                  🔄 Generate New Code
                </button>
                <button
                  onClick={() => setShowRevokeConfirm(true)}
                  className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded font-medium"
                  disabled={loading}
                >
                  ❌ Revoke Access
                </button>
              </div>

              {/* Info Banner */}
              <div className="bg-blue-900/20 border border-blue-500/30 rounded p-3 text-xs text-blue-300">
                <p className="font-semibold mb-1">💡 Tip:</p>
                <p>Players stay connected when you switch encounters! They'll automatically see your current encounter.</p>
              </div>
            </div>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="w-full px-4 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded font-medium"
            >
              Done
            </button>
          </div>
        ) : null}

        {/* Regenerate Confirmation Overlay */}
        {showRegenerateConfirm && (
          <div className="absolute inset-0 bg-black/80 rounded-lg flex items-center justify-center p-6">
            <div className="bg-slate-700 rounded-lg p-6 max-w-sm">
              <h3 className="text-xl font-bold text-white mb-3">⚠️ Generate New Code?</h3>
              <p className="text-slate-300 mb-6">
                The old code will stop working immediately. Players using the old code will need to scan the new QR code or enter the new code.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={regenerateShareCode}
                  className="flex-1 px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded font-medium"
                >
                  Yes, Generate New
                </button>
                <button
                  onClick={() => setShowRegenerateConfirm(false)}
                  className="flex-1 px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded font-medium"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Revoke Confirmation Overlay */}
        {showRevokeConfirm && (
          <div className="absolute inset-0 bg-black/80 rounded-lg flex items-center justify-center p-6">
            <div className="bg-slate-700 rounded-lg p-6 max-w-sm">
              <h3 className="text-xl font-bold text-white mb-3">❌ Revoke Access?</h3>
              <p className="text-slate-300 mb-6">
                This will permanently disable the share code. All players will lose access and you'll need to generate a new code to share again.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={revokeShareCode}
                  className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded font-medium"
                >
                  Yes, Revoke
                </button>
                <button
                  onClick={() => setShowRevokeConfirm(false)}
                  className="flex-1 px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded font-medium"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
