import React from "react";

interface NicolettaLogoProps {
  className?: string;
  size?: number; // width and height in pixels (defaults to responsive)
  showText?: boolean; // whether to show Nicoletta Crafts & Decor text beside the badge
  colorTheme?: "light" | "dark";
  logoText?: string;
  logoSubtext?: string;
  logoImageUrl?: string;
  hideBorder?: boolean;
}

export const NicolettaLogo: React.FC<NicolettaLogoProps> = ({
  className = "",
  size,
  showText = true,
  colorTheme = "light",
  logoText = "Nicoletta",
  logoSubtext = "Crafts & Decor",
  logoImageUrl = "",
  hideBorder = false
}) => {
  const goldColor = "#C2824C"; // Rich Caramel Gold
  const darkColor = colorTheme === "light" ? "#42352B" : "#FDFBF7"; // Dark Caramel Cocoa vs Soft Ivory White
  const mutedColor = colorTheme === "light" ? "#8E7D70" : "#E8DFD5"; // Warm Taupe vs Sand Beige
  const [imgError, setImgError] = React.useState(false);

  React.useEffect(() => {
    setImgError(false);
  }, [logoImageUrl]);

  return (
    <div className={`flex items-center gap-3 ${className}`} id="nicoletta-logo-wrapper">
      {/* Circle Icon Badge */}
      {logoImageUrl && !imgError ? (
        <img
          id="nicoletta-logo-image"
          src={logoImageUrl}
          alt={logoText || "Custom Logo"}
          onError={() => setImgError(true)}
          style={{ 
            width: size || 56, 
            height: size || 56, 
            backgroundColor: colorTheme === "dark" ? "transparent" : "#ffffff"
          }}
          className={`shrink-0 rounded-full object-contain shadow-xs transition-transform duration-300 group-hover:scale-105 ${hideBorder ? "" : "border-2 border-brand-primary"}`}
          referrerPolicy="no-referrer"
        />
      ) : (
        <svg
          id="nicoletta-logo-badge"
          width={size || 56}
          height={size || 56}
          viewBox="0 0 400 400"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="shrink-0 transition-transform duration-300 group-hover:scale-105"
        >
        {/* Outer Circular Rope Border (Concentric ring with delicate spacing for premium rope effect) */}
        {!hideBorder && (
          <>
            <circle
              cx="200"
              cy="200"
              r="176"
              stroke={goldColor}
              strokeWidth="1"
              opacity="0.5"
            />
            <circle
              cx="200"
              cy="200"
              r="170"
              stroke={goldColor}
              strokeWidth="3.5"
              strokeDasharray="4, 5"
              strokeLinecap="round"
            />
            <circle
              cx="200"
              cy="200"
              r="164"
              stroke={goldColor}
              strokeWidth="1"
              opacity="0.5"
            />
          </>
        )}

        {/* --- LEFT SIDE FLORAL BRAND (Elegant climbing stems, leaves, and a soft rose bud) --- */}
        {/* Left main stem */}
        <path
          d="M 120 330 C 70 270 65 170 100 95"
          stroke={goldColor}
          strokeWidth="2.5"
          strokeLinecap="round"
          fill="none"
        />
        {/* Rose Bud at the top left (100, 95) */}
        <path
          d="M 100 95 C 80 75 70 95 85 115 C 95 130 115 110 100 95"
          fill="#FDFBF7"
          stroke={goldColor}
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path
          d="M 90 105 C 102 90 110 105 102 118"
          stroke={goldColor}
          strokeWidth="1.5"
          fill="none"
        />
        
        {/* Smaller leaf branches climbing up */}
        {/* Leaf 1 */}
        <path
          d="M 85 195 C 65 185 60 165 80 165 C 92 165 92 185 85 195"
          fill="#FDFBF7"
          stroke={goldColor}
          strokeWidth="1.5"
        />
        {/* Leaf 2 */}
        <path
          d="M 100 145 C 85 135 80 115 95 115 C 105 115 105 135 100 145"
          fill="#FDFBF7"
          stroke={goldColor}
          strokeWidth="1.5"
        />
        {/* Leaf 3 */}
        <path
          d="M 88 245 C 70 240 70 220 85 220 C 95 220 95 240 88 245"
          fill="#FDFBF7"
          stroke={goldColor}
          strokeWidth="1.5"
        />

        {/* --- BOTTOM RIGHT FLORAL BRAND (Climbing rose blossom and leaves) --- */}
        {/* Right stem */}
        <path
          d="M 260 345 C 320 330 345 285 330 220"
          stroke={goldColor}
          strokeWidth="2.5"
          strokeLinecap="round"
          fill="none"
        />
        {/* Blossom at bottom right (330, 220) */}
        <path
          d="M 330 220 C 355 205 365 225 350 245 C 335 265 315 245 330 220"
          fill="#FDFBF7"
          stroke={goldColor}
          strokeWidth="2"
          strokeLinecap="round"
        />
        {/* Leaf branches */}
        <path
          d="M 295 335 C 315 345 330 335 320 315 C 305 300 295 320 295 335"
          fill="#FDFBF7"
          stroke={goldColor}
          strokeWidth="1.5"
        />
        <path
          d="M 320 290 C 338 295 348 280 338 265 C 325 255 315 275 320 290"
          fill="#FDFBF7"
          stroke={goldColor}
          strokeWidth="1.5"
        />

        {/* Inner Small Accent Dots */}
        <circle cx="265" cy="115" r="3" fill={goldColor} opacity="0.7" />
        <circle cx="115" cy="305" r="2.5" fill={goldColor} opacity="0.6" />
        <circle cx="342" cy="170" r="2.5" fill={goldColor} opacity="0.6" />

        {/* --- CENTER TYPOGRAPHY DESIGN --- */}
        {/* Brand Name: NICOLETTA */}
        <text
          x="200"
          y="205"
          textAnchor="middle"
          fill={darkColor}
          fontSize="48"
          fontFamily="'Playfair Display', Georgia, serif"
          fontWeight="700"
          letterSpacing="1.5"
        >
          {logoText ? logoText.toUpperCase() : "NICOLETTA"}
        </text>

        {/* Subtitle: CRAFTS & DECOR */}
        <text
          x="200"
          y="250"
          textAnchor="middle"
          fill={mutedColor}
          fontSize="17"
          fontFamily="'Inter', sans-serif"
          fontWeight="600"
          letterSpacing="7"
        >
          {logoSubtext ? logoSubtext.toUpperCase() : "CRAFTS & DECOR"}
        </text>
      </svg>
      )}

      {/* Accompanying Styled Header Typography */}
      {showText && (
        <div className="flex flex-col">
          <span
            className="font-serif font-black text-lg md:text-xl tracking-tight uppercase leading-none"
            style={{ color: darkColor }}
          >
            {logoText}
          </span>
          <span
            className="text-[9px] tracking-widest uppercase font-bold mt-0.5"
            style={{ color: mutedColor }}
          >
            {logoSubtext}
          </span>
        </div>
      )}
    </div>
  );
};
