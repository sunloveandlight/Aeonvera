"use client";

import { useEffect, useRef, useState, ReactNode } from "react";

type MotionProps = {
  children: ReactNode;
  intensity?: "subtle" | "medium" | "strong";
  type?: "fade" | "rise" | "scale" | "parallax";
  className?: string;
};

export default function Motion({
  children,
  intensity = "subtle",
  type = "fade",
  className = "",
}: MotionProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(0);

  const intensityMap = {
    subtle: 0.08,
    medium: 0.15,
    strong: 0.25,
  };

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setVisible(entry.isIntersecting);
      },
      {
        threshold: 0.15,
      }
    );

    observer.observe(el);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      if (!ref.current) return;

      const rect = ref.current.getBoundingClientRect();
      const windowHeight = window.innerHeight;

      const visibleProgress =
        1 - Math.min(Math.max(rect.top / windowHeight, 0), 1);

      setProgress(visibleProgress);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();

    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const opacity = visible ? 1 : 0;

  const transform = (() => {
    const intensityFactor = intensityMap[intensity];

    switch (type) {
      case "fade":
        return `translateY(${(1 - progress) * 20 * intensityFactor}px)`;
      case "rise":
        return `translateY(${(1 - progress) * -30 * intensityFactor}px)`;
      case "scale":
        return `scale(${0.96 + progress * intensityFactor})`;
      case "parallax":
        return `translateY(${(1 - progress) * 40 * intensityFactor}px)`;
      default:
        return "none";
    }
  })();

  return (
    <div
      ref={ref}
      className={`
        transition-opacity duration-700 ease-out
        ${className}
      `}
      style={{
        opacity,
        transform,
        willChange: "transform, opacity",
      }}
    >
      {children}
    </div>
  );
}