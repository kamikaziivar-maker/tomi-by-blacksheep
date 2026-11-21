import React, { useEffect, useState } from 'react';

interface BrandLogoProps {
  customLogoDataUrl?: string;
  sizeClass?: string;
  roundedClass?: string;
  className?: string;
  frameless?: boolean;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  customLogoDataUrl,
  sizeClass = 'h-16 w-16',
  roundedClass = 'rounded-2xl',
  className = '',
  frameless = false,
}) => {
  const src = customLogoDataUrl || '/logo.png';
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    setImgError(false);
  }, [src]);

  // Style du conteneur : sans bordure ni fond gris par défaut pour laisser le logo respirer
  const containerStyle = frameless
    ? 'bg-transparent border-none'
    : 'bg-transparent border border-zinc-800/40';

  return (
    <div
      className={`flex items-center justify-center overflow-hidden ${containerStyle} ${sizeClass} ${roundedClass} ${className}`}
    >
      {!imgError ? (
        <img
          src={src}
          alt="TOMI by BlackSheep"
          onError={() => setImgError(true)}
          // mix-blend-screen rend le fond noir pur transparent ; contrast-125 renforce l'éclat argenté
          className="h-full w-full object-contain mix-blend-screen contrast-125 select-none"
        />
      ) : (
        <svg
          viewBox="0 0 36 36"
          className="h-[58%] w-[58%] text-[#F5B971]"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M7 11.5H29M18 11.5V27.5"
            stroke="currentColor"
            strokeWidth="2.6"
            strokeLinecap="round"
          />
          <path
            d="M10.5 23.5L18 16L25.5 23.5"
            stroke="#10B981"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </div>
  );
};