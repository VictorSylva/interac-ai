import React, { useRef, useState, useEffect } from 'react';

export default function AutoSlider({ children, speed = 1.2, autoScroll = true }) {
  const containerRef = useRef(null);
  const [isDown, setIsDown] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeftState, setScrollLeftState] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  // Mouse Down handler (Desktop drag start)
  const handleMouseDown = (e) => {
    setIsDown(true);
    setIsPaused(true);
    setStartX(e.pageX - containerRef.current.offsetLeft);
    setScrollLeftState(containerRef.current.scrollLeft);
  };

  // Mouse Leave handler (Desktop drag cancel)
  const handleMouseLeave = () => {
    setIsDown(false);
    if (!isPaused) setIsPaused(false);
  };

  // Mouse Up handler (Desktop drag end)
  const handleMouseUp = () => {
    setIsDown(false);
    // Add small delay before resuming auto-scroll to make interaction feel natural
    setTimeout(() => {
      setIsPaused(false);
    }, 1500);
  };

  // Mouse Move handler (Desktop dragging)
  const handleMouseMove = (e) => {
    if (!isDown) return;
    e.preventDefault();
    const x = e.pageX - containerRef.current.offsetLeft;
    const walk = (x - startX) * 1.5; // Scroll speed modifier
    containerRef.current.scrollLeft = scrollLeftState - walk;
  };

  // Touch Start handler (Mobile swipe start)
  const handleTouchStart = (e) => {
    setIsDown(true);
    setIsPaused(true);
    setStartX(e.touches[0].pageX - containerRef.current.offsetLeft);
    setScrollLeftState(containerRef.current.scrollLeft);
  };

  // Touch End handler (Mobile swipe end)
  const handleTouchEnd = () => {
    setIsDown(false);
    setTimeout(() => {
      setIsPaused(false);
    }, 1500);
  };

  // Touch Move handler (Mobile swiping)
  const handleTouchMove = (e) => {
    if (!isDown) return;
    const x = e.touches[0].pageX - containerRef.current.offsetLeft;
    const walk = (x - startX) * 1.5;
    containerRef.current.scrollLeft = scrollLeftState - walk;
  };

  // Auto-scroll logic loop
  useEffect(() => {
    if (!autoScroll) return;

    let animationFrameId;

    const scrollLoop = () => {
      if (containerRef.current && !isPaused && !isDown) {
        containerRef.current.scrollLeft += speed;
        
        // Loop back to beginning when reaching the end
        if (containerRef.current.scrollLeft >= (containerRef.current.scrollWidth - containerRef.current.clientWidth - 2)) {
          containerRef.current.scrollLeft = 0;
        }
      }
      animationFrameId = requestAnimationFrame(scrollLoop);
    };

    animationFrameId = requestAnimationFrame(scrollLoop);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [isPaused, isDown, speed, autoScroll]);

  return (
    <div className="relative w-full group">
      {/* Visual fading indicators on edges */}
      <div className="absolute left-0 top-0 bottom-0 w-24 bg-gradient-to-r from-[#020617] to-transparent pointer-events-none z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      <div className="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l from-[#020617] to-transparent pointer-events-none z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

      {/* Scroller Container */}
      <div
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onMouseLeave={handleMouseLeave}
        onMouseUp={handleMouseUp}
        onMouseMove={handleMouseMove}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchMove={handleTouchMove}
        onMouseEnter={() => setIsPaused(true)}
        className="w-full flex flex-row gap-6 overflow-x-auto select-none scrollbar-none py-4 px-2"
        style={{
          cursor: isDown ? 'grabbing' : 'grab',
          scrollBehavior: isDown ? 'auto' : 'smooth',
          msOverflowStyle: 'none',
          scrollbarWidth: 'none',
        }}
      >
        {children}
      </div>
    </div>
  );
}
