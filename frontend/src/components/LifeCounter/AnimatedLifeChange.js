import React, { useState, useEffect, useRef } from 'react';

function AnimatedLifeChange({ currentLife }) {
  const [anim, setAnim] = useState(null); // { dir: 'gain' | 'loss', seq: number } | null
  const prevLifeRef = useRef(currentLife);
  const seqRef = useRef(0);

  useEffect(() => {
    const prev = prevLifeRef.current;
    if (currentLife === prev) return undefined;
    prevLifeRef.current = currentLife;

    // The number itself renders straight from `currentLife`, so the new total
    // is visible on this very render. (The old implementation delayed
    // `displayLife` by 300ms after the LAST change, which froze the number
    // while the player tapped repeatedly.)
    seqRef.current += 1;
    setAnim({ dir: currentLife > prev ? 'gain' : 'loss', seq: seqRef.current });

    const timer = setTimeout(() => setAnim(null), 300);
    return () => clearTimeout(timer);
  }, [currentLife]);

  return (
    // Keyed remount per change so the CSS animation retriggers on every tap
    // (re-applying the same class name alone would not restart it).
    <div
      key={anim ? anim.seq : 'static'}
      className={`transition-all duration-300 ${anim ? `animate-life-${anim.dir}` : ''}`}
    >
      {currentLife}
    </div>
  );
}

// Add CSS for animations
const style = document.createElement('style');
style.textContent = `
  @keyframes lifeGain {
    0% { transform: scale(1); color: inherit; }
    50% { transform: scale(1.3); color: #10b981; }
    100% { transform: scale(1); color: inherit; }
  }

  @keyframes lifeLoss {
    0% { transform: scale(1); color: inherit; }
    50% { transform: scale(0.8); color: #ef4444; }
    100% { transform: scale(1); color: inherit; }
  }

  .animate-life-gain {
    animation: lifeGain 0.3s ease-in-out;
  }

  .animate-life-loss {
    animation: lifeLoss 0.3s ease-in-out;
  }
`;

// Check if the style is already added to avoid duplicates
if (!document.querySelector('#animated-life-change-style')) {
  style.id = 'animated-life-change-style';
  document.head.appendChild(style);
}

export default AnimatedLifeChange;
