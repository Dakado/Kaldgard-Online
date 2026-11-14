import React from 'react';

interface TitleOverlayProps {
  onStart: () => void;
}

export const TitleOverlay: React.FC<TitleOverlayProps> = ({ onStart }) => {
  return (
    <div className="fixed inset-0 z-20 flex flex-col justify-between pointer-events-none px-6 py-8 md:px-12 md:py-10">
      {/* Top negative-space atmospheric gradient scrim for legibility */}
      <div
        className="fixed inset-x-0 top-0 h-64 pointer-events-none"
        style={{
          background:
            'linear-gradient(180deg, rgba(14, 20, 32, 0.82) 0%, rgba(14, 20, 32, 0.45) 55%, rgba(14, 20, 32, 0) 100%)',
        }}
      />
      <div
        className="fixed inset-x-0 bottom-0 h-44 pointer-events-none"
        style={{
          background:
            'linear-gradient(0deg, rgba(16, 23, 36, 0.78) 0%, rgba(16, 23, 36, 0.35) 55%, rgba(16, 23, 36, 0) 100%)',
        }}
      />

      {/* Top Centered Royal Prontera Lockup */}
      <div className="relative z-10 flex flex-col items-center text-center pt-2 md:pt-4">
        <svg
          width="58"
          height="58"
          viewBox="0 0 64 64"
          fill="none"
          aria-hidden="true"
          className="mb-3 drop-shadow"
        >
          <path
            d="M32 4L56 14V32C56 46 45.5 55.8 32 60C18.5 55.8 8 46 8 32V14L32 4Z"
            fill="#1D2B44"
            stroke="#E2BF6B"
            strokeWidth="2.5"
          />
          <path
            d="M32 12L48 19V31C48 41 40.8 48.4 32 51.8C23.2 48.4 16 41 16 31V19L32 12Z"
            fill="#2B4269"
            stroke="#C9A24E"
            strokeWidth="1.2"
          />
          <path
            d="M32 18L36 28L45 28L37.8 33.8L40.4 43L32 37.5L23.6 43L26.2 33.8L19 28L28 28L32 18Z"
            fill="#F4D57E"
          />
        </svg>

        <h1
          className="font-display text-4xl md:text-6xl font-bold tracking-[0.12em] text-[#fdf7e7]"
          style={{ textShadow: '0 3px 16px rgba(10, 15, 24, 0.85)' }}
        >
          PRONTERA
        </h1>
        <p
          className="mt-1.5 text-sm md:text-base font-medium tracking-wide text-[#e5d8bc]"
          style={{ textShadow: '0 2px 10px rgba(10, 15, 24, 0.9)' }}
        >
          Královské hlavní město · 3D RPG mapa
        </p>
      </div>

      {/* Bottom CTA & Single-Line Control Hint */}
      <div className="relative z-10 flex flex-col items-center gap-4 pb-2">
        <button
          type="button"
          data-start="true"
          onClick={(e) => {
            e.currentTarget.blur();
            onStart();
          }}
          className="pointer-events-auto cursor-pointer px-8 py-3.5 rounded-lg font-display text-base md:text-lg font-bold tracking-wider text-[#1a140a] bg-[#e2bc62] hover:bg-[#efd07f] active:scale-[0.98] transition-all shadow-[0_6px_24px_rgba(0,0,0,0.5)] border border-[#fff2c6]/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#fff2c6]"
        >
          Vstoupit do města
        </button>

        <p
          className="text-xs md:text-sm text-[#e7decb]/90 text-center"
          style={{ textShadow: '0 1px 6px rgba(0, 0, 0, 0.9)' }}
        >
          Levý klik / WASD Pohyb · Mezerník / F Útok · Pravý tah / Q E Kamera · Kolečko Přiblížení
        </p>
      </div>
    </div>
  );
};
