import React, { useState, useEffect } from "react";
import { CustomSection } from "../types";

interface HeroSlideshowProps {
  sec: CustomSection;
}

const DEFAULT_FALLBACK_IMAGES = [
  "https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&q=80&w=1200",
  "https://images.unsplash.com/photo-1513519245088-0e12902e5a38?auto=format&fit=crop&q=80&w=1200",
  "https://images.unsplash.com/photo-1544982503-9f984c14501a?auto=format&fit=crop&q=80&w=1200",
  "https://images.unsplash.com/photo-1610701596007-11502861dcfa?auto=format&fit=crop&q=80&w=1200",
  "https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?auto=format&fit=crop&q=80&w=1200",
  "https://images.unsplash.com/photo-1513519245088-0e12902e5a38?auto=format&fit=crop&q=80&w=1200"
];

export function HeroSlideshow({ sec }: HeroSlideshowProps) {
  // Detect phone / smaller screens (< 768px)
  const [isMobile, setIsMobile] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return window.innerWidth < 768;
    }
    return false;
  });

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Extract images from imageUrls array, or fallback to imageUrl, or default curated craft photos
  const images = React.useMemo(() => {
    let list: string[] = [];
    if (Array.isArray(sec?.imageUrls) && sec.imageUrls.length > 0) {
      list = sec.imageUrls.filter(
        (url): url is string =>
          typeof url === "string" &&
          url.trim() !== "" &&
          !url.includes("artisan_394acdc2da743ca35c5bc9fd7b47052a")
      );
    }
    if (
      list.length === 0 &&
      typeof sec?.imageUrl === "string" &&
      sec.imageUrl.trim() !== "" &&
      !sec.imageUrl.includes("artisan_394acdc2da743ca35c5bc9fd7b47052a")
    ) {
      list = [sec.imageUrl.trim()];
    }
    if (list.length === 0) {
      return DEFAULT_FALLBACK_IMAGES;
    }
    return list;
  }, [sec?.imageUrls, sec?.imageUrl]);

  // If on a phone or smaller screen (<768px), display 1 photo per slide in exact upload order.
  // On desktop / larger screens, group images into 3 photos per slide.
  const slides = React.useMemo(() => {
    if (images.length === 0) return [];

    if (isMobile) {
      // Individual photo carousel on mobile
      return images.map((img) => [img]);
    }

    // Normal 3-photo carousel on desktop
    const chunked: string[][] = [];
    const numSlides = Math.max(1, Math.ceil(images.length / 3));
    for (let i = 0; i < numSlides; i++) {
      const slideImages: string[] = [];
      for (let j = 0; j < 3; j++) {
        const imgIndex = (i * 3 + j) % images.length;
        slideImages.push(images[imgIndex]);
      }
      chunked.push(slideImages);
    }
    return chunked;
  }, [images, isMobile]);

  const [currentIndex, setCurrentIndex] = useState(0);

  // Rotate carousel every 2 seconds for both mobile and normal desktop views
  useEffect(() => {
    if (slides.length <= 1) {
      setCurrentIndex(0);
      return;
    }

    const interval = setInterval(() => {
      setCurrentIndex((prevIndex) => (prevIndex + 1) % slides.length);
    }, 2000); // Changes every 2 seconds

    return () => clearInterval(interval);
  }, [slides.length]);

  const activeSlideIndex = slides.length > 0 ? currentIndex % slides.length : 0;

  return (
    <div className="absolute inset-0 w-full h-full overflow-hidden bg-stone-950">
      {/* Slides */}
      {slides.map((slideImages, idx) => {
        const isActive = idx === activeSlideIndex;
        return (
          <div
            key={`hero-slide-${isMobile ? "mob" : "desk"}-${idx}`}
            className={`absolute inset-0 transition-all duration-700 ease-in-out transform ${
              isMobile ? "grid grid-cols-1" : "grid grid-cols-3"
            } ${
              isActive ? "opacity-100 scale-100" : "opacity-0 scale-105 pointer-events-none"
            }`}
          >
            {slideImages.map((imgUrl, imgIdx) => (
              <div
                key={`hero-slide-${idx}-photo-${imgIdx}`}
                className="relative h-full w-full overflow-hidden bg-stone-900"
              >
                <img
                  src={imgUrl}
                  alt={`Hero Showcase ${idx + 1} - ${imgIdx + 1}`}
                  referrerPolicy="no-referrer"
                  className="absolute inset-0 w-full h-full object-cover object-center transition-transform duration-700 hover:scale-102"
                  onError={(e) => {
                    const target = e.currentTarget;
                    const fallback = DEFAULT_FALLBACK_IMAGES[imgIdx % DEFAULT_FALLBACK_IMAGES.length];
                    if (target.src !== fallback) {
                      target.src = fallback;
                    }
                  }}
                />
              </div>
            ))}
          </div>
        );
      })}

      {/* Dark overlay with dynamic backdrop blur */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[0.5px] pointer-events-none" />

      {/* Slideshow Indicator Dots */}
      {slides.length > 1 && (
        <div className="absolute bottom-4 md:bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-1.5 md:gap-2 z-20 max-w-[90vw] overflow-x-auto py-1 px-2 scrollbar-none">
          {slides.map((_, idx) => (
            <button
              key={`dot-${idx}`}
              type="button"
              onClick={() => setCurrentIndex(idx)}
              className={`h-1.5 rounded-full transition-all duration-300 shrink-0 ${
                idx === activeSlideIndex ? "w-5 md:w-6 bg-brand-primary" : "w-1.5 bg-white/40 hover:bg-white/70"
              }`}
              aria-label={`Go to slide ${idx + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
