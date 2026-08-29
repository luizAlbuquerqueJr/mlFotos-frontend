import { useEffect, useRef } from "react";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  width: number;
  height: number;
  rotation: number;
  spin: number;
  color: string;
  life: number;
}

const COLORS = ["#fbbf24", "#f59e0b", "#fde68a", "#fb7185", "#fda4af", "#fff7ed", "#e11d48"];

interface ConfettiBurstProps {
  playToken: number;
}

export function ConfettiBurst({ playToken }: ConfettiBurstProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!playToken) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();

    const originX = canvas.width / 2;
    const originY = canvas.height * 0.38;
    const particles: Particle[] = [];

    for (let i = 0; i < 140; i += 1) {
      const angle = (Math.PI * 2 * i) / 140 + (Math.random() - 0.5) * 0.4;
      const speed = 7 + Math.random() * 11;
      particles.push({
        x: originX,
        y: originY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 6,
        width: 5 + Math.random() * 7,
        height: 8 + Math.random() * 10,
        rotation: Math.random() * Math.PI,
        spin: (Math.random() - 0.5) * 0.28,
        color: COLORS[i % COLORS.length],
        life: 1,
      });
    }

    let frame = 0;
    let raf = 0;
    const gravity = 0.22;
    const drag = 0.992;

    const tick = () => {
      frame += 1;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (const particle of particles) {
        particle.vy += gravity;
        particle.vx *= drag;
        particle.x += particle.vx;
        particle.y += particle.vy;
        particle.rotation += particle.spin;
        particle.life -= 0.008;

        if (particle.life <= 0) continue;

        ctx.save();
        ctx.globalAlpha = Math.max(0, particle.life);
        ctx.translate(particle.x, particle.y);
        ctx.rotate(particle.rotation);
        ctx.fillStyle = particle.color;
        ctx.fillRect(-particle.width / 2, -particle.height / 2, particle.width, particle.height);
        ctx.restore();
      }

      if (frame < 180) {
        raf = window.requestAnimationFrame(tick);
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    };

    raf = window.requestAnimationFrame(tick);
    window.addEventListener("resize", resize);

    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    };
  }, [playToken]);

  if (!playToken) return null;

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 z-[80]"
      aria-hidden
    />
  );
}
