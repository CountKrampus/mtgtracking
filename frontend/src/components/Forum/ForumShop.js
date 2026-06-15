import React, { useState, useEffect } from 'react';
import { ShoppingCart, Coins } from 'lucide-react';

const SHOP_ITEMS = [
  { id: 'avatar_frame_1', name: 'Gold Avatar Frame', price: 500, description: 'Gold frame', category: 'cosmetic' },
  { id: 'username_color_1', name: 'Purple Username', price: 300, description: 'Purple color', category: 'cosmetic' },
  { id: 'badge_vip', name: 'VIP Badge', price: 1000, description: 'VIP status', category: 'badge' },
  { id: 'thread_bump', name: 'Thread Bump', price: 100, description: 'Bump thread', category: 'utility' }
];

export default function ForumShop({ apiUrl, user, isOpen, onClose }) {
  const [userLevel, setUserLevel] = useState(null);

  useEffect(() => {
    if (isOpen && user) {
      const fetch_ = async () => {
        try {
          const response = await fetch(`${apiUrl}/forum/user-level`);
          const data = await response.json();
          setUserLevel(data);
        } catch (error) {
          console.error('Error:', error);
        }
      };
      fetch_();
    }
  }, [isOpen, user, apiUrl]);

  if (!isOpen || !user) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-slate-800 rounded-lg max-w-4xl w-full border border-slate-700 p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <ShoppingCart size={28} />
            <h2 className="text-2xl font-bold text-white">Forum Shop</h2>
          </div>
          {userLevel && (
            <div className="flex items-center gap-2 bg-slate-900 px-4 py-2 rounded">
              <Coins size={20} className="text-yellow-400" />
              <span className="font-bold text-white">{userLevel.coins}</span>
              <span className="text-slate-400">Level {userLevel.level}</span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          {SHOP_ITEMS.map(item => (
            <div key={item.id} className="p-4 rounded border-2 bg-slate-900 border-slate-600">
              <h3 className="font-semibold text-white">{item.name}</h3>
              <p className="text-sm text-slate-400 mb-2">{item.description}</p>
              <div className="flex items-center gap-1">
                <Coins size={14} className="text-yellow-400" />
                <span className="font-bold text-yellow-400">{item.price}</span>
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={onClose}
          className="mt-4 w-full px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded text-white"
        >
          Close
        </button>
      </div>
    </div>
  );
}
