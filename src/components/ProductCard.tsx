import React from "react";
import { Tag, Sparkles, CheckCircle, AlertTriangle, MessageSquare, Play } from "lucide-react";
import { Product, Category } from "../types";

interface ProductCardProps {
  key?: string;
  product: Product;
  categoryName: string;
  onRequestQuote: (p: Product) => void;
}

export default function ProductCard({ product, categoryName, onRequestQuote }: ProductCardProps): React.JSX.Element {
  const hasPromo = product.promoPrice !== undefined && product.promoPrice < product.price;
  const discountPercent = hasPromo ? Math.round(((product.price - (product.promoPrice ?? 0)) / product.price) * 100) : 0;

  return (
    <div
      id={`product-card-${product.id}`}
      className="bg-white rounded-[24px] border border-brand-border shadow-xs hover:shadow-md transition-all duration-300 overflow-hidden flex flex-col group h-full p-4 gap-3"
    >
      {/* Product Image Panel */}
      <div className="relative aspect-4/3 bg-brand-highlight rounded-[18px] overflow-hidden">
        <img
          src={product.images[0] || "https://images.unsplash.com/photo-1544982503-9f984c14501a?auto=format&fit=crop&q=80&w=600"}
          alt={product.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          referrerPolicy="no-referrer"
        />
        {/* Category & Status badges */}
        <div className="absolute top-3 left-3 flex flex-col gap-1.5 items-start">
          <span className="bg-brand-dark/90 backdrop-blur-xs text-white text-[9px] tracking-widest uppercase font-bold px-2 py-0.5 rounded-full">
            {categoryName}
          </span>
          {product.featured && (
            <span className="bg-brand-primary text-white text-[9px] tracking-widest uppercase font-bold px-2 py-0.5 rounded-full flex items-center gap-1 border border-brand-border/20">
              <Sparkles className="h-2.5 w-2.5 fill-white stroke-none" /> Featured
            </span>
          )}
          {product.videoUrl && (
            <span className="bg-amber-950/90 backdrop-blur-xs text-amber-200 text-[9px] tracking-wider uppercase font-bold px-2 py-0.5 rounded-full flex items-center gap-1 border border-amber-500/20 shadow-xs">
              <Play className="h-2 w-2 fill-amber-200 stroke-none" /> Video
            </span>
          )}
        </div>

        {/* Promo Discount Tag */}
        {hasPromo && (
          <div className="absolute top-3 right-3 bg-brand-primary text-white text-[9px] font-bold px-2 py-0.5 rounded-full shadow-xs tracking-wider">
            -{discountPercent}%
          </div>
        )}

        {/* Out of Stock Overlays */}
        {!product.inStock && (
          <div className="absolute inset-0 bg-brand-dark/60 backdrop-blur-xs flex items-center justify-center p-4">
            <span className="bg-brand-dark text-brand-highlight font-bold tracking-widest text-[10px] uppercase px-3 py-1.5 rounded-full border border-brand-border/10 text-center">
              Backordered
            </span>
          </div>
        )}
      </div>

      {/* Product Information */}
      <div className="flex-1 flex flex-col justify-between px-1">
        <div>
          {/* Header & Pricing */}
          <div className="flex justify-between items-start gap-2 mb-2">
            <h3 className="font-serif font-bold text-brand-text text-base md:text-lg group-hover:text-brand-primary transition-colors line-clamp-1">
              {product.name}
            </h3>
            <div className="flex flex-col items-end shrink-0 font-sans">
              {hasPromo ? (
                <>
                  <span className="text-red-700 font-bold text-sm md:text-base whitespace-nowrap">
                    {product.maxPrice 
                      ? `$${product.promoPrice} - $${Math.round((product.promoPrice ?? 0) * (product.maxPrice / product.price))}`
                      : `$${product.promoPrice}`
                    }
                  </span>
                  <span className="text-brand-muted line-through text-[10px] whitespace-nowrap">
                    {product.maxPrice ? `$${product.price} - $${product.maxPrice}` : `$${product.price}`}
                  </span>
                </>
              ) : (
                <span className="text-brand-text font-bold text-sm md:text-base whitespace-nowrap">
                  {product.maxPrice ? `$${product.price} - $${product.maxPrice}` : `$${product.price}`}
                </span>
              )}
            </div>
          </div>

          {/* Description */}
          <p className="text-brand-muted text-xs leading-relaxed line-clamp-3 mb-3">
            {product.description}
          </p>

          {/* Custom Options Display */}
          {product.customOptions && product.customOptions.length > 0 && (
            <div className="mb-3">
              <span className="text-[9px] text-brand-muted font-bold tracking-widest uppercase block mb-1">
                Customizations:
              </span>
              <div className="flex flex-wrap gap-1">
                {product.customOptions.map((opt, i) => (
                  <span
                    key={i}
                    className="text-[9px] bg-brand-highlight text-brand-primary border border-brand-border px-1.5 py-0.5 rounded-md font-medium"
                  >
                    {opt}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Customization Note */}
          <div className="mb-2 bg-amber-50/90 border border-amber-200/90 rounded-[10px] px-2.5 py-1.5 text-[10px] text-amber-950 flex items-center gap-1.5 shadow-3xs">
            <Sparkles className="h-3 w-3 text-amber-700 shrink-0" />
            <span className="font-medium leading-tight">
              Can be customized — click to request similar pieces or custom sizes!
            </span>
          </div>
        </div>

        {/* Footer Availability and Quote Trigger */}
        <div className="pt-2 border-t border-brand-border mt-auto flex items-center justify-between gap-2">
          <div className="flex items-center gap-1 text-[10px] font-sans">
            {product.inStock ? (
              <span className="text-brand-primary flex items-center gap-1 font-semibold">
                <CheckCircle className="h-3 w-3" /> In Stock
              </span>
            ) : (
              <span className="text-brand-muted flex items-center gap-1 font-semibold">
                <AlertTriangle className="h-3 w-3" /> Custom Only
              </span>
            )}
          </div>

          <button
            id={`quote-btn-${product.id}`}
            onClick={(e) => {
              e.stopPropagation();
              onRequestQuote(product);
            }}
            className="flex items-center gap-1.5 bg-brand-primary hover:bg-brand-primary-hover text-white text-[10px] uppercase tracking-widest font-bold px-3 py-1.5 rounded-full cursor-pointer transition-colors"
          >
            <MessageSquare className="h-2.5 w-2.5" />
            Inquire to Order
          </button>
        </div>
      </div>
    </div>
  );
}
