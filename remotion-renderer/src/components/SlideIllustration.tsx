import React from "react";
import { interpolate, useCurrentFrame } from "remotion";

interface SlideIllustrationProps {
  slideNumber: 1 | 2 | 3 | 4;
  currentTimeSeconds: number;
  accentColor: string;
  size?: number;
}

const SlideIllustration: React.FC<SlideIllustrationProps> = ({
  slideNumber,
  currentTimeSeconds,
  accentColor,
  size = 180,
}) => {
  const frame = useCurrentFrame();

  const containerStyle: React.CSSProperties = {
    position: "absolute",
    right: 40,
    bottom: 60,
    width: size,
    height: size,
    pointerEvents: "none",
  };

  // ── Slide 1: Network connection diagram ──────────────────────────────────────
  if (slideNumber === 1) {
    const cx = size / 2;
    const nodes = [
      { cx, cy: 24 },
      { cx: 22, cy: size - 28 },
      { cx: size - 22, cy: size - 28 },
    ];
    const lines = [
      { x1: nodes[0].cx, y1: nodes[0].cy, x2: nodes[1].cx, y2: nodes[1].cy },
      { x1: nodes[0].cx, y1: nodes[0].cy, x2: nodes[2].cx, y2: nodes[2].cy },
      { x1: nodes[1].cx, y1: nodes[1].cy, x2: nodes[2].cx, y2: nodes[2].cy },
    ];
    const satellites = [
      { cx: nodes[0].cx - 26, cy: nodes[0].cy - 16 },
      { cx: nodes[0].cx + 26, cy: nodes[0].cy - 16 },
      { cx: nodes[1].cx - 20, cy: nodes[1].cy + 16 },
      { cx: nodes[2].cx + 20, cy: nodes[2].cy + 16 },
    ];
    const satelliteOpacity = 0.2 + 0.4 * ((Math.sin(currentTimeSeconds * 2) + 1) / 2);

    return (
      <div style={{ ...containerStyle, opacity: 0.55 }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {lines.map((ln, i) => {
            const len = Math.hypot(ln.x2 - ln.x1, ln.y2 - ln.y1);
            const dashOffset = interpolate(frame, [i * 8, 40 + i * 4], [len, 0], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            return (
              <line
                key={i}
                x1={ln.x1} y1={ln.y1} x2={ln.x2} y2={ln.y2}
                stroke={accentColor} strokeWidth={1.5}
                strokeDasharray={len} strokeDashoffset={dashOffset}
              />
            );
          })}
          {nodes.map((n, i) => {
            const r = interpolate(frame, [40 + i * 10, 55 + i * 10], [0, 12], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            return (
              <circle
                key={i}
                cx={n.cx} cy={n.cy} r={r}
                fill={accentColor} fillOpacity={0.1}
                stroke={accentColor} strokeWidth={1.5}
              />
            );
          })}
          {satellites.map((s, i) => (
            <circle key={i} cx={s.cx} cy={s.cy} r={4}
              fill={accentColor} opacity={satelliteOpacity} />
          ))}
        </svg>
      </div>
    );
  }

  // ── Slide 2: Lightbulb ───────────────────────────────────────────────────────
  if (slideNumber === 2) {
    const cx = size / 2;
    const cy = size / 2 - 10;
    const bulbR = 42;
    const circumference = 2 * Math.PI * bulbR;
    const bulbDash = interpolate(frame, [0, 60], [circumference, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    const rays = Array.from({ length: 6 }, (_, i) => {
      const angle = (i * 60 * Math.PI) / 180;
      const inner = bulbR + 8;
      const outer = bulbR + 22;
      const appearFrame = 55 + i * 8;
      const rayOpacity = interpolate(frame, [appearFrame, appearFrame + 8], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });
      const allDone = frame > 55 + 5 * 8 + 8;
      const rot = allDone ? Math.sin(currentTimeSeconds) * 4 : 0;
      return {
        x1: cx + inner * Math.cos(angle),
        y1: cy + inner * Math.sin(angle),
        x2: cx + outer * Math.cos(angle),
        y2: cy + outer * Math.sin(angle),
        rayOpacity,
        rot,
      };
    });

    return (
      <div style={{ ...containerStyle, opacity: 0.55 }}>
        {/* Glow halo */}
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}
          style={{ position: "absolute", top: 0, left: 0 }}>
          <circle cx={cx} cy={cy} r={bulbR}
            fill="none" stroke={accentColor} strokeWidth={4} opacity={0.08} />
        </svg>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle cx={cx} cy={cy} r={bulbR}
            fill={accentColor} fillOpacity={0.06}
            stroke={accentColor} strokeWidth={2}
            strokeDasharray={circumference} strokeDashoffset={bulbDash} />
          <line x1={cx - 12} y1={cy + bulbR + 6} x2={cx - 12} y2={cy + bulbR + 18}
            stroke={accentColor} strokeWidth={2} />
          <line x1={cx + 12} y1={cy + bulbR + 6} x2={cx + 12} y2={cy + bulbR + 18}
            stroke={accentColor} strokeWidth={2} />
          {rays.map((ray, i) => (
            <g key={i} transform={`rotate(${ray.rot}, ${cx}, ${cy})`}>
              <line x1={ray.x1} y1={ray.y1} x2={ray.x2} y2={ray.y2}
                stroke={accentColor} strokeWidth={1.5} opacity={ray.rayOpacity} />
            </g>
          ))}
        </svg>
      </div>
    );
  }

  // ── Slide 3: Terminal window ──────────────────────────────────────────────────
  if (slideNumber === 3) {
    const w = 160;
    const h = 110;
    const ox = (size - w) / 2;
    const oy = (size - h) / 2;
    const perimeter = 2 * (w + h);
    const borderDash = interpolate(frame, [0, 40], [perimeter, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    const codeLines = [
      { width: 120, y: oy + 38, tf: 55 },
      { width: 90,  y: oy + 55, tf: 65 },
      { width: 110, y: oy + 72, tf: 75 },
      { width: 70,  y: oy + 89, tf: 85 },
    ];
    const cursorVisible = frame >= 85 && Math.floor(currentTimeSeconds * 2) % 2 === 0;

    return (
      <div style={{ ...containerStyle, opacity: 0.55 }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <rect x={ox} y={oy} width={w} height={h} rx={8}
            fill="none" stroke={accentColor} strokeWidth={1.5}
            strokeDasharray={perimeter} strokeDashoffset={borderDash} />
          {[42, 46, 50].map((bf, i) => {
            const r = interpolate(frame, [bf, bf + 8], [0, 5], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            return (
              <circle key={i} cx={ox + 14 + i * 16} cy={oy + 20} r={r}
                fill={accentColor} fillOpacity={0.4} />
            );
          })}
          {codeLines.map((cl, i) => {
            const op = interpolate(frame, [cl.tf, cl.tf + 10], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            const tx = interpolate(frame, [cl.tf, cl.tf + 10], [-15, 0], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            return (
              <line key={i}
                x1={ox + 16 + tx} y1={cl.y}
                x2={ox + 16 + cl.width + tx} y2={cl.y}
                stroke={accentColor} strokeWidth={2} opacity={op} />
            );
          })}
          {cursorVisible && (
            <rect x={ox + 90} y={oy + 82} width={8} height={14}
              fill={accentColor} opacity={0.8} />
          )}
        </svg>
      </div>
    );
  }

  // ── Slide 4: Question mark ────────────────────────────────────────────────────
  const s4cx = size / 2;
  const qPath = [
    `M ${size * 0.3} ${size * 0.25}`,
    `C ${size * 0.3} ${size * 0.1} ${size * 0.7} ${size * 0.1} ${size * 0.7} ${size * 0.3}`,
    `C ${size * 0.7} ${size * 0.45} ${size * 0.55} ${size * 0.5} ${s4cx} ${size * 0.58}`,
    `L ${s4cx} ${size * 0.68}`,
  ].join(" ");
  const pathLen = 260;
  const qDash = interpolate(frame, [0, 80], [pathLen, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const dotR = interpolate(frame, [85, 95], [0, 5], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const pulseScale = frame > 80
    ? 0.95 + 0.1 * ((Math.sin(currentTimeSeconds * 1.5) + 1) / 2)
    : 1;

  return (
    <div style={{ ...containerStyle, opacity: 0.5 }}>
      <svg
        width={size} height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{ transform: `scale(${pulseScale})`, transformOrigin: "center" }}
      >
        <path d={qPath}
          fill="none" stroke={accentColor} strokeWidth={3}
          strokeLinecap="round"
          strokeDasharray={pathLen} strokeDashoffset={qDash} />
        <circle cx={s4cx} cy={size * 0.78} r={dotR}
          fill="none" stroke={accentColor} strokeWidth={3} />
      </svg>
    </div>
  );
};

export default SlideIllustration;
