"use client";

import { motion } from "framer-motion";
import { ReactNode } from "react";

type Props = {
  children: ReactNode;
  type?: "fade" | "rise" | "scale";
  intensity?: "subtle" | "medium";
};

export default function Motion({
  children,
  type = "fade",
  intensity = "subtle",
}: Props) {
  const distance = intensity === "subtle" ? 10 : 20;

  const variants = {
    fade: {
      initial: { opacity: 0 },
      animate: { opacity: 1 },
    },
    rise: {
      initial: { opacity: 0, y: distance },
      animate: { opacity: 1, y: 0 },
    },
    scale: {
      initial: { opacity: 0, scale: 0.98 },
      animate: { opacity: 1, scale: 1 },
    },
  };

  return (
    <motion.div
      initial={variants[type].initial}
      animate={variants[type].animate}
      transition={{
        duration: 0.6,
        ease: [0.16, 1, 0.3, 1],
      }}
    >
      {children}
    </motion.div>
  );
}