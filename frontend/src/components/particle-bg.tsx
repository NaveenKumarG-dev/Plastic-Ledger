import { useEffect, useState } from "react";

export function ParticleBg() {
  const [particles, setParticles] = useState<{ x: number; d: number; s: number; o: number }[]>([]);
  useEffect(() => {
    setParticles(
      Array.from({ length: 30 }).map(() => ({
        x: Math.random() * 100,
        d: 8 + Math.random() * 14,
        s: 2 + Math.random() * 4,
        o: Math.random() * 5,
      })),
    );
  }, []);
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {particles.map((p, i) => (
        <span
          key={i}
          className="absolute bottom-0 block rounded-full bg-secondary/60 blur-[1px]"
          style={{
            left: `${p.x}%`,
            width: p.s,
            height: p.s,
            animation: `rise ${p.d}s linear ${p.o}s infinite`,
          }}
        />
      ))}
      {/* wave */}
      <svg
        className="absolute -bottom-4 left-0 w-[200%] h-40 opacity-20"
        style={{ animation: "wave 18s linear infinite" }}
        viewBox="0 0 2400 200"
        preserveAspectRatio="none"
      >
        <path
          d="M0 100 Q 300 20 600 100 T 1200 100 T 1800 100 T 2400 100 V200 H0 Z"
          fill="oklch(0.65 0.19 250)"
        />
      </svg>
    </div>
  );
}

export function AnimatedCounter({ to, decimals = 0, suffix = "" }: { to: number; decimals?: number; suffix?: string }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    const start = performance.now();
    const dur = 1400;
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      setV(to * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to]);
  return <span>{v.toLocaleString(undefined, { maximumFractionDigits: decimals, minimumFractionDigits: decimals })}{suffix}</span>;
}
