"use client";

import React, { useEffect } from 'react';
import { ReactLenis, useLenis } from '@studio-freight/react-lenis';

// Automatically hijacks all # links and glides to them using Lenis physics
const AnchorInterceptor = () => {
  const lenis = useLenis();

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const anchor = target.closest('a');

      if (anchor) {
        const href = anchor.getAttribute('href');
        
        // Target only internal anchor links (e.g., #features, #pricing)
        if (href && href.startsWith('#') && href.length > 1) {
          e.preventDefault();
          // offset: -100 ensures your fixed navbar doesn't cover the top of the section
          lenis?.scrollTo(href, { offset: -100 });
        }
      }
    };

    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [lenis]);

  return null;
};

export default function SmoothScrolling({ children }: { children: React.ReactNode }) {
  return (
    <ReactLenis 
      root 
      options={{ 
        lerp: 0.1,
        wheelMultiplier: 1,
        smoothWheel: true,
        touchMultiplier: 2,
      }}
    >
      <AnchorInterceptor />
      {/* Cast to any to silence the React 19 vs React 18 type collision */}
      {children as any}
    </ReactLenis>
  );
}