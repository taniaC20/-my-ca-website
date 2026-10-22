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

const processedLogoCache = new Map<string, { light: string; dark: string }>();

function processLogoTransparency(srcUrl: string): Promise<{ light: string; dark: string }> {
  const cached = processedLogoCache.get(srcUrl);
  if (cached) return Promise.resolve(cached);

  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const w = img.naturalWidth || img.width;
        const h = img.naturalHeight || img.height;
        if (!w || !h) {
          resolve({ light: srcUrl, dark: srcUrl });
          return;
        }

        const lightCanvas = document.createElement("canvas");
        lightCanvas.width = w;
        lightCanvas.height = h;
        const lightCtx = lightCanvas.getContext("2d");

        const darkCanvas = document.createElement("canvas");
        darkCanvas.width = w;
        darkCanvas.height = h;
        const darkCtx = darkCanvas.getContext("2d");

        if (!lightCtx || !darkCtx) {
          resolve({ light: srcUrl, dark: srcUrl });
          return;
        }

        lightCtx.drawImage(img, 0, 0, w, h);
        const lightData = lightCtx.getImageData(0, 0, w, h);
        const darkData = darkCtx.createImageData(w, h);
        const src = lightData.data;
        const dstDark = darkData.data;

        for (let i = 0; i < src.length; i += 4) {
          const r = src[i];
          const g = src[i + 1];
          const b = src[i + 2];
          const a = src[i + 3];

          if (a === 0) {
            dstDark[i] = 255;
            dstDark[i + 1] = 255;
            dstDark[i + 2] = 255;
            dstDark[i + 3] = 0;
            continue;
          }

          const lum = 0.299 * r + 0.587 * g + 0.114 * b;
          const maxCh = Math.max(r, g, b);
          const minCh = Math.min(r, g, b);
          const isNearNeutralWhite = lum >= 244 && (maxCh - minCh) <= 18;

          if (isNearNeutralWhite) {
            // Pure white/off-white background pixel -> make 100% transparent
            src[i + 3] = 0;
            dstDark[i] = 255;
            dstDark[i + 1] = 255;
            dstDark[i + 2] = 255;
            dstDark[i + 3] = 0;
          } else {
            // Smoothly un-premultiply white halo on anti-aliased edge pixels
            const alphaNorm = lum > 180 ? Math.min(1, Math.max(0, (248 - lum) / 68)) : 1;
            const finalAlpha = Math.round(alphaNorm * a);

            if (finalAlpha <= 2) {
              src[i + 3] = 0;
              dstDark[i + 3] = 0;
            } else {
              const rFg = Math.max(0, Math.min(255, Math.round((r - (1 - alphaNorm) * 255) / alphaNorm)));
              const gFg = Math.max(0, Math.min(255, Math.round((g - (1 - alphaNorm) * 255) / alphaNorm)));
              const bFg = Math.max(0, Math.min(255, Math.round((b - (1 - alphaNorm) * 255) / alphaNorm)));

              src[i] = rFg;
              src[i + 1] = gFg;
              src[i + 2] = bFg;
              src[i + 3] = finalAlpha;

              // Footer ("dark" theme): pure crisp white logo on transparent background
              dstDark[i] = 255;
              dstDark[i + 1] = 255;
              dstDark[i + 2] = 255;
              dstDark[i + 3] = finalAlpha;
            }
          }
        }

        lightCtx.putImageData(lightData, 0, 0);
        darkCtx.putImageData(darkData, 0, 0);

        const result = {
          light: lightCanvas.toDataURL("image/png"),
          dark: darkCanvas.toDataURL("image/png")
        };
        processedLogoCache.set(srcUrl, result);
        resolve(result);
      } catch {
        resolve({ light: srcUrl, dark: srcUrl });
      }
    };
    img.onerror = () => reject(new Error("Logo load error"));
    img.src = srcUrl;
  });
}

export const NicolettaLogo: React.FC<NicolettaLogoProps> = ({
  className = "",
  size,
  showText = true,
  colorTheme = "light",
  logoText = "Nicoletta",
  logoSubtext = "Crafts & Decor",
  logoImageUrl = "",
  hideBorder = true
}) => {
  const goldColor = colorTheme === "dark" ? "#FFFFFF" : "#C2824C"; // White in dark footer, Rich Caramel Gold in light header
  const darkColor = colorTheme === "light" ? "#42352B" : "#FFFFFF"; // Dark Caramel Cocoa vs Crisp White
  const mutedColor = colorTheme === "light" ? "#8E7D70" : "rgba(255, 255, 255, 0.85)"; // Warm Taupe vs Soft White
  const floralFillColor = colorTheme === "dark" ? "none" : "transparent";
  const [imgError, setImgError] = React.useState(false);
  const [processedUrls, setProcessedUrls] = React.useState<{ light: string; dark: string } | null>(() =>
    logoImageUrl ? processedLogoCache.get(logoImageUrl) || null : null
  );

  React.useEffect(() => {
    setImgError(false);
    if (!logoImageUrl) {
      setProcessedUrls(null);
      return;
    }
    const cached = processedLogoCache.get(logoImageUrl);
    if (cached) {
      setProcessedUrls(cached);
      return;
    }
    let cancelled = false;
    processLogoTransparency(logoImageUrl)
      .then((res) => {
        if (!cancelled) setProcessedUrls(res);
      })
      .catch(() => {
        if (!cancelled) setImgError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [logoImageUrl]);

  const effectiveImgSrc = processedUrls
    ? colorTheme === "dark"
      ? processedUrls.dark
      : processedUrls.light
    : logoImageUrl;

  return (
    <div className={`flex items-center gap-3 ${className}`} id="nicoletta-logo-wrapper">
      {/* Brand Logo Mark (Transparent Background, No Circle Border) */}
      {logoImageUrl && !imgError ? (
        <img
          id="nicoletta-logo-image"
          src={effectiveImgSrc}
          alt={logoText || "Custom Logo"}
          onError={() => setImgError(true)}
          style={{
            width: size || 56,
            height: size || 56,
            backgroundColor: "transparent",
            filter: !processedUrls && colorTheme === "dark" ? "brightness(0) invert(1)" : undefined
          }}
          className="shrink-0 object-contain bg-transparent border-0 rounded-none shadow-none transition-transform duration-300 group-hover:scale-105"
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
          className="shrink-0 bg-transparent transition-transform duration-300 group-hover:scale-105"
        >
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
          fill={floralFillColor}
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
          fill={floralFillColor}
          stroke={goldColor}
          strokeWidth="1.5"
        />
        {/* Leaf 2 */}
        <path
          d="M 100 145 C 85 135 80 115 95 115 C 105 115 105 135 100 145"
          fill={floralFillColor}
          stroke={goldColor}
          strokeWidth="1.5"
        />
        {/* Leaf 3 */}
        <path
          d="M 88 245 C 70 240 70 220 85 220 C 95 220 95 240 88 245"
          fill={floralFillColor}
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
          fill={floralFillColor}
          stroke={goldColor}
          strokeWidth="2"
          strokeLinecap="round"
        />
        {/* Leaf branches */}
        <path
          d="M 295 335 C 315 345 330 335 320 315 C 305 300 295 320 295 335"
          fill={floralFillColor}
          stroke={goldColor}
          strokeWidth="1.5"
        />
        <path
          d="M 320 290 C 338 295 348 280 338 265 C 325 255 315 275 320 290"
          fill={floralFillColor}
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
