import React from "react";

const HeroVisual = () => {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Abstract Shapes */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-600/20 rounded-full blur-[120px] animate-pulse" />
      <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-indigo-900/30 rounded-full blur-[150px]" />

      {/* Grid Overlay */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      {/* Floating Elements (Mocking AI nodes) */}
      <div
        className="absolute top-20 right-[10%] w-2 h-2 bg-blue-400 rounded-full animate-float"
        style={{ animationDelay: "1s" }}
      />
      <div
        className="absolute bottom-40 left-[15%] w-3 h-3 bg-indigo-400 rounded-full animate-float"
        style={{ animationDelay: "3s" }}
      />
      <div
        className="absolute top-1/2 left-[5%] w-2 h-2 bg-blue-500 rounded-full animate-float"
        style={{ animationDelay: "2s" }}
      />
    </div>
  );
};

export default HeroVisual;
