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

  // Layer 3: 6 large slowly drifting geometric shapes
  const shapes = React.useMemo(() => {
    return Array.from({ length: 6 }, (_, i) => {
      const size = 60 + i * 15;
      const initX = (i * 213) % 1280;
      const initY = (i * 157) % 720;
      const driftX = Math.sin(i * 1.3) * 8;
      const driftY = Math.cos(i * 0.9) * 6;
      const rotSpeed = 2 + i * 1.2;
      const isCircle = i % 2 === 0;
      return { size, initX, initY, driftX, driftY, rotSpeed, isCircle };
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
      {/* Layer 3 — drifting geometric shapes as single SVG overlay */}
      <svg
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none",
          overflow: "hidden",
        }}
      >
        {shapes.map((s, i) => {
          const sx = ((s.initX + s.driftX * currentTimeSeconds) % 1280 + 1280) % 1280;
          const sy = ((s.initY + s.driftY * currentTimeSeconds) % 720 + 720) % 720;
          const rotation = s.rotSpeed * currentTimeSeconds;
          const opacity = 0.03 + (i % 4) * 0.01;
          const r = s.size / 2;

          if (s.isCircle) {
            return (
              <circle
                key={i}
                cx={sx}
                cy={sy}
                r={r}
                fill="none"
                stroke={accentColor}
                strokeWidth={1}
                opacity={opacity}
                transform={`rotate(${rotation} ${sx} ${sy})`}
              />
            );
          }

          // Hexagon as SVG polygon
          const pts = Array.from({ length: 6 }, (_, k) => {
            const angle = (k * 60 - 30) * (Math.PI / 180);
            return `${sx + r * Math.cos(angle)},${sy + r * Math.sin(angle)}`;
          }).join(" ");

          return (
            <polygon
              key={i}
              points={pts}
              fill="none"
              stroke={accentColor}
              strokeWidth={1}
              opacity={opacity}
              transform={`rotate(${rotation} ${sx} ${sy})`}
            />
          );
        })}
      </svg>
    </div>
  );
};

export default AnimatedBackground;
