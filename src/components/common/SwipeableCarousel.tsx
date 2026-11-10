import React, { useRef, useState, useEffect } from 'react';

export interface SwipeableCarouselProps {
  children: React.ReactNode;
  totalItems: number;
  initialIndex?: number;
  className?: string;
  dotsClassName?: string;
  gridClassName?: string; // Classes de grid para Desktop, ex: "md:grid-cols-2" ou "md:grid-cols-4"
}

export const SwipeableCarousel: React.FC<SwipeableCarouselProps> = ({
  children,
  totalItems,
  initialIndex = 0,
  className = '',
  dotsClassName = '',
  gridClassName = 'md:grid-cols-2',
}) => {
  const carouselRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(initialIndex);

  const handleScroll = () => {
    if (!carouselRef.current) return;
    const { scrollLeft, clientWidth } = carouselRef.current;
    if (clientWidth === 0) return;
    const itemWidth = clientWidth * 0.85;
    const index = Math.round(scrollLeft / (itemWidth + 12));
    const clamped = Math.min(Math.max(0, index), totalItems - 1);
    setActiveIndex(clamped);
  };

  const scrollToIndex = (idx: number) => {
    if (!carouselRef.current) return;
    const childrenNodes = carouselRef.current.children;
    if (childrenNodes[idx]) {
      (childrenNodes[idx] as HTMLElement).scrollIntoView({
        behavior: 'smooth',
        inline: 'center',
        block: 'nearest',
      });
      setActiveIndex(idx);
    }
  };

  useEffect(() => {
    if (initialIndex > 0 && carouselRef.current) {
      const timer = setTimeout(() => {
        scrollToIndex(initialIndex);
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [initialIndex]);

  return (
    <div className="w-full">
      <div
        ref={carouselRef}
        onScroll={handleScroll}
        className={`flex overflow-x-auto snap-x snap-mandatory gap-3 pb-3 -mx-4 px-4 scrollbar-none [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] md:grid ${gridClassName} md:overflow-visible md:p-0 md:m-0 ${className}`}
      >
        {children}
      </div>

      {/* Dots de Paginação no Mobile (< md) */}
      {totalItems > 1 && (
        <div
          className={`flex items-center justify-center gap-1.5 pt-1 pb-2 md:hidden ${dotsClassName}`}
          aria-hidden="true"
        >
          {Array.from({ length: totalItems }).map((_, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => scrollToIndex(idx)}
              className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer ${
                activeIndex === idx
                  ? 'w-6 bg-emerald-500 shadow-sm shadow-emerald-500/50'
                  : 'w-1.5 bg-slate-700 hover:bg-slate-600'
              }`}
              aria-label={`Ir para item ${idx + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
};
