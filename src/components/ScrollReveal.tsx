import { forwardRef } from "react";
import { motion } from "framer-motion";
import type { HTMLMotionProps } from "framer-motion";
import type { ReactNode } from "react";

type Direction = "up" | "down" | "left" | "right";

interface ScrollRevealProps extends Omit<HTMLMotionProps<"div">, "children"> {
  children: ReactNode;
  direction?: Direction;
  delay?: number;
  duration?: number;
  distance?: number;
  once?: boolean;
  className?: string;
}

const offsets: Record<Direction, { x: number; y: number }> = {
  up: { x: 0, y: 1 },
  down: { x: 0, y: -1 },
  left: { x: 1, y: 0 },
  right: { x: -1, y: 0 },
};

const ScrollReveal = forwardRef<HTMLDivElement, ScrollRevealProps>(
  (
    {
      children,
      direction = "up",
      delay = 0,
      duration = 0.6,
      distance = 30,
      once = true,
      className,
      ...rest
    },
    ref
  ) => {
    const offset = offsets[direction];

    return (
      <motion.div
        ref={ref}
        initial={{ opacity: 0, x: offset.x * distance, y: offset.y * distance }}
        whileInView={{ opacity: 1, x: 0, y: 0 }}
        viewport={{ once, margin: "-60px" }}
        transition={{ duration, delay, ease: [0.25, 0.1, 0.25, 1] }}
        className={className}
        {...rest}
      >
        {children}
      </motion.div>
    );
  }
);

ScrollReveal.displayName = "ScrollReveal";

export default ScrollReveal;
