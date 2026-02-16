import React, { useState, useEffect } from 'react';

function AnimatedLifeChange({ currentLife, onChange }) {
  const [displayLife, setDisplayLife] = useState(currentLife);
  const [animationClass, setAnimationClass] = useState('');

  useEffect(() => {
    if (currentLife !== displayLife) {
      const difference = currentLife - displayLife;
      setAnimationClass(difference > 0 ? 'animate-life-gain' : 'animate-life-loss');
      
      // Update the display life after a short delay to show animation
      const timer = setTimeout(() => {
        setDisplayLife(currentLife);
        setAnimationClass('');
      }, 300);

      return () => clearTimeout(timer);
    }
  }, [currentLife, displayLife]);

  return (
    <div className={`transition-all duration-300 ${animationClass}`}>
      {displayLife}
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