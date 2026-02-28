import React from "react";

interface AnimatedBackgroundProps {
  width: number;
  height: number;
  currentTimeSeconds: number;
  accentColor: string;
}

const AnimatedBackground: React.FC<AnimatedBackgroundProps> = ({
  width,
  height,
  currentTimeSeconds,
  accentColor,
}) => {
  // Layer 1: gradient wave — 8-second cycle
  const wave = Math.sin((currentTimeSeconds * 2 * Math.PI) / 8);
  // Interpolate between RGB(10,15,35) and RGB(18,25,55), wave in [-1,1] → [0,1]
  const t = (wave + 1) / 2;
  const r = Math.round(10 + t * (18 - 10));
  const g = Math.round(15 + t * (25 - 15));
  const b = Math.round(35 + t * (55 - 35));
  const bgColor = `rgb(${r},${g},${b})`;

  // Layer 2: 40 consistent particles
  const particles = React.useMemo(() => {
    return Array.from({ length: 40 }, (_, i) => {
      const baseX = (i * 137.5) % 1280;
      const baseY = (i * 97.3) % 720;
      const speedX = Math.sin(i) * 25 + 10;
      const speedY = Math.cos(i * 0.7) * 20 + 8;
      const radius = (i % 3) + 1.5;
      const opacity = ((i % 4) + 3) * 0.08;
      return { baseX, baseY, speedX, speedY, radius, opacity };
    });
  }, []);

  return (
    <div style={{ position: "absolute", width, height, overflow: "hidden" }}>
      {/* Layer 1 — animated gradient wave */}
      <div
        style={{
          position: "absolute",
          width: "100%",
          height: "100%",
          backgroundColor: bgColor,
        }}
      />
      {/* Layer 2 — particle field */}
      {particles.map((p, i) => {
        let px = (p.baseX + p.speedX * currentTimeSeconds) % 1280;
        if (px < 0) px += 1280;
        let py = (p.baseY + p.speedY * currentTimeSeconds) % 720;
        if (py < 0) py += 720;

        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: px,
              top: py,
              width: p.radius * 2,
              height: p.radius * 2,
              borderRadius: "50%",
              backgroundColor: accentColor,
              opacity: p.opacity,
            }}
          />
        );
      })}
    </div>
  );
};

export default AnimatedBackground;
