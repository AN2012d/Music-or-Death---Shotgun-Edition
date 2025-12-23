
import React from 'react';

interface ShotgunProps {
  isFiring: boolean;
  isCorrect?: boolean;
}

export const Shotgun: React.FC<ShotgunProps> = ({ isFiring, isCorrect }) => {
  const showEffects = isFiring && !isCorrect;

  return (
    <div className={`relative flex justify-center items-center transition-all duration-300 ${showEffects ? 'animate-recoil' : ''}`}>
      
      {/* Visual Effects Layer */}
      {showEffects && (
        <>
          {/* Muzzle Flash */}
          <div className="absolute top-[20%] right-[-10%] z-30 pointer-events-none">
            <div className="w-80 h-80 bg-orange-600 rounded-full blur-[70px] animate-pulse opacity-90 scale-150" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-40 h-40 bg-white rounded-full blur-3xl opacity-100" />
          </div>

          {/* Drifting Smoke */}
          <div className="absolute top-[-80px] right-8 z-10 pointer-events-none">
            <div className="w-24 h-24 bg-zinc-200/40 rounded-full blur-2xl animate-smoke" style={{ animationDelay: '0s' }} />
            <div className="w-32 h-32 bg-zinc-400/30 rounded-full blur-[45px] animate-smoke" style={{ animationDelay: '0.1s' }} />
            <div className="w-18 h-18 bg-zinc-100/20 rounded-full blur-xl animate-smoke" style={{ animationDelay: '0.2s' }} />
          </div>

          {/* Spent Shell Ejection (Brass) - Animates away from ejection port */}
          <div className="absolute top-[45%] left-[35%] z-20 pointer-events-none animate-shell">
            <div className="w-10 h-5 bg-gradient-to-br from-yellow-300 via-yellow-500 to-yellow-800 rounded-sm border border-yellow-900 shadow-[0_0_15px_rgba(234,179,8,0.5)] flex items-center justify-center">
                <div className="w-1 h-3 bg-black/20" /> {/* Primer detail on shell */}
            </div>
          </div>
        </>
      )}
      
      <svg 
        viewBox="0 0 400 160" 
        className={`w-80 md:w-[750px] drop-shadow-[0_45px_70px_rgba(0,0,0,1)] transition-all duration-500 ${isFiring ? (isCorrect ? 'text-green-500 scale-105' : 'text-zinc-100 brightness-150') : 'text-zinc-500'}`}
      >
        <defs>
          <linearGradient id="metalChrome" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#666" />
            <stop offset="20%" stopColor="#aaa" />
            <stop offset="40%" stopColor="#333" />
            <stop offset="100%" stopColor="#111" />
          </linearGradient>
          <linearGradient id="woodStock" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#5d301b" />
            <stop offset="100%" stopColor="#2a140b" />
          </linearGradient>
          <radialGradient id="barrelGlow">
            <stop offset="0%" stopColor="rgba(255, 60, 0, 0.6)" />
            <stop offset="100%" stopColor="transparent" />
          </radialGradient>
        </defs>

        <g transform="translate(20, 40)">
          {/* Detailed Stock - Heavy Tactical Feel */}
          <path d="M0,60 L70,45 L90,105 L15,115 Z" fill="url(#woodStock)" stroke="#000" strokeWidth="3" />
          <path d="M70,45 L130,40 L140,100 L90,105 Z" fill="#1a1a1a" stroke="#000" strokeWidth="2" />
          <rect x="20" y="70" width="45" height="4" rx="1" fill="#000" opacity="0.4" />
          
          {/* Main Frame / Receiver */}
          <rect x="130" y="30" width="110" height="65" rx="8" fill="url(#metalChrome)" stroke="#000" strokeWidth="3" />
          
          {/* Ejection Port - Highlighted for visibility */}
          <rect x="150" y="48" width="70" height="28" rx="4" fill="#050505" stroke="#333" strokeWidth="1" />
          <path d="M155,52 L215,52" stroke="#222" strokeWidth="1" /> {/* Mechanical detail */}
          
          {/* Pins and Screws */}
          <circle cx="165" cy="82" r="4" fill="#222" stroke="#000" />
          <circle cx="215" cy="82" r="4" fill="#222" stroke="#000" />
          
          {/* Trigger Guard & Trigger */}
          <path d="M150,95 Q175,125 210,95" fill="none" stroke="#222" strokeWidth="7" />
          <path d="M175,98 L170,112 L180,112 Z" fill="#444" stroke="#000" />
          
          {/* Magazine Tube */}
          <rect x="240" y="68" width="140" height="16" rx="4" fill="#0a0a0a" stroke="#000" strokeWidth="2" />
          
          {/* Massive Heavy Barrel */}
          <rect x="240" y="40" width="160" height="22" rx="4" fill="url(#metalChrome)" stroke="#000" strokeWidth="2.5" />
          <rect x="390" y="40" width="10" height="22" fill="url(#barrelGlow)" opacity={showEffects ? 1 : 0} />
          
          {/* Tactical Sights */}
          <rect x="250" y="32" width="15" height="8" fill="#111" rx="1" />
          <circle cx="395" cy="36" r="3" fill="#ff0000" style={{ filter: 'drop-shadow(0 0 5px red)' }} />
          
          {/* Pump Handle (Pump Action Detailing) */}
          <g transform={`translate(${showEffects ? -45 : 0}, 0)`} className="transition-transform duration-100 ease-in">
            <rect x="260" y="62" width="95" height="34" rx="10" fill="#111" stroke="#000" strokeWidth="3" />
            {[272, 287, 302, 317, 332].map(x => (
              <rect key={x} x={x} y="66" width="5" height="26" rx="1.5" fill="#000" opacity="0.8" />
            ))}
          </g>
        </g>
      </svg>
      
      {showEffects && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-40">
            <span className="text-red-600 text-[9rem] md:text-[18rem] font-orbitron font-black drop-shadow-[0_0_80px_rgba(220,38,38,1)] animate-shake italic tracking-tighter uppercase opacity-95 scale-110">
              BOOM!
            </span>
        </div>
      )}
    </div>
  );
};
