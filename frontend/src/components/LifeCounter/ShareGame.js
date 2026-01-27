import React, { useState } from 'react';
import { Share2, Copy, Check, Link2, X, Download } from 'lucide-react';
import useBackendSync from './hooks/useBackendSync';

function ShareGame({ isOpen, onClose, gameState, onLoadGame }) {
  const [shareCode, setShareCode] = useState('');
  const [loadCode, setLoadCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [tab, setTab] = useState('share'); // 'share' | 'load'
  const { shareGame, loadSharedGame, loading, error } = useBackendSync();

  const handleShare = async () => {
    if (!gameState) return;

    const result = await shareGame(gameState);
    if (result?.code) {
      setShareCode(result.code);
    }
  };

  const handleCopy = async () => {
    const shareUrl = `${window.location.origin}/life-counter?share=${shareCode}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = shareUrl;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(shareCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleLoad = async () => {
    if (!loadCode.trim()) return;

    const gameData = await loadSharedGame(loadCode.trim().toUpperCase());
    if (gameData) {
      onLoadGame(gameData);
      onClose();
    }
  };

  // Simple QR Code generation (uses a basic pattern)
  const generateQRPattern = (code) => {
    // This is a simplified visual representation, not a real QR code
    // For a real implementation, use a library like qrcode
    const pattern = [];
    const size = 7;
    for (let i = 0; i < size; i++) {
      const row = [];
      for (let j = 0; j < size; j++) {
        // Create a pattern based on the code
        const charIndex = (i * size + j) % code.length;
        const charCode = code.charCodeAt(charIndex);
        row.push(charCode % 2 === 0);
      }
      pattern.push(row);
    }
    return pattern;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-2xl p-6 max-w-md w-full shadow-2xl border border-white/20">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <Share2 size={24} className="text-blue-400" />
            Share Game
          </h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition"
          >
            <X size={20} className="text-white/60" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setTab('share')}
            className={`flex-1 py-2 rounded-lg font-medium transition ${
              tab === 'share'
                ? 'bg-blue-600 text-white'
                : 'bg-white/10 text-white/60 hover:bg-white/20'
            }`}
          >
            Share
          </button>
          <button
            onClick={() => setTab('load')}
            className={`flex-1 py-2 rounded-lg font-medium transition ${
              tab === 'load'
                ? 'bg-blue-600 text-white'
                : 'bg-white/10 text-white/60 hover:bg-white/20'
            }`}
          >
            Load
          </button>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-4 p-3 bg-red-900/30 border border-red-500 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Share Tab */}
        {tab === 'share' && (
          <div>
            {!shareCode ? (
              <div className="text-center py-8">
                <Share2 size={48} className="text-blue-400 mx-auto mb-4" />
                <p className="text-white/60 mb-6">
                  Generate a link to share your current game state with others.
                  The link expires after 24 hours.
                </p>
                <button
                  onClick={handleShare}
                  disabled={loading || !gameState}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-semibold transition disabled:opacity-50"
                >
                  {loading ? 'Generating...' : 'Generate Share Link'}
                </button>
                {!gameState && (
                  <p className="text-white/40 text-sm mt-2">
                    Start a game first to share it
                  </p>
                )}
              </div>
            ) : (
              <div>
                {/* Share Code Display */}
                <div className="bg-white/5 rounded-xl p-4 mb-4 text-center">
                  <div className="text-white/60 text-sm mb-2">Share Code</div>
                  <div className="text-4xl font-mono font-bold text-blue-400 tracking-wider">
                    {shareCode}
                  </div>
                </div>

                {/* QR Code Placeholder */}
                <div className="bg-white/5 rounded-xl p-4 mb-4">
                  <div className="text-white/60 text-sm mb-2 text-center">Visual Code</div>
                  <div className="flex justify-center">
                    <div className="bg-white p-2 rounded-lg">
                      <div className="grid gap-0.5">
                        {generateQRPattern(shareCode).map((row, i) => (
                          <div key={i} className="flex gap-0.5">
                            {row.map((cell, j) => (
                              <div
                                key={j}
                                className={`w-4 h-4 ${cell ? 'bg-black' : 'bg-white'}`}
                              />
                            ))}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="text-white/40 text-xs text-center mt-2">
                    (Visual representation - share the code above)
                  </div>
                </div>

                {/* Copy Buttons */}
                <div className="flex gap-2">
                  <button
                    onClick={handleCopyCode}
                    className="flex-1 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-semibold transition flex items-center justify-center gap-2"
                  >
                    {copied ? <Check size={18} /> : <Copy size={18} />}
                    {copied ? 'Copied!' : 'Copy Code'}
                  </button>
                  <button
                    onClick={handleCopy}
                    className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-semibold transition flex items-center justify-center gap-2"
                  >
                    <Link2 size={18} />
                    Copy Link
                  </button>
                </div>

                <p className="text-white/40 text-xs text-center mt-4">
                  Link expires in 24 hours
                </p>
              </div>
            )}
          </div>
        )}

        {/* Load Tab */}
        {tab === 'load' && (
          <div>
            <div className="text-center py-4">
              <Download size={48} className="text-green-400 mx-auto mb-4" />
              <p className="text-white/60 mb-4">
                Enter a share code to load a game state
              </p>
            </div>

            <input
              type="text"
              value={loadCode}
              onChange={(e) => setLoadCode(e.target.value.toUpperCase())}
              placeholder="Enter share code..."
              className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white text-center text-xl font-mono tracking-widest placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-green-500 mb-4"
              maxLength={8}
            />

            <button
              onClick={handleLoad}
              disabled={loading || !loadCode.trim()}
              className="w-full py-3 bg-green-600 hover:bg-green-500 text-white rounded-xl font-semibold transition disabled:opacity-50"
            >
              {loading ? 'Loading...' : 'Load Game'}
            </button>
          </div>
        )}

        {/* Close Button */}
        <button
          onClick={onClose}
          className="mt-6 w-full py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-semibold transition"
        >
          Close
        </button>
      </div>
    </div>
  );
}

export default ShareGame;
