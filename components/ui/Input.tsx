"use client";

import {
  forwardRef,
  InputHTMLAttributes,
  useState,
} from "react";
import { motion } from "framer-motion";

type InputSize = "sm" | "md" | "lg";

interface InputProps
  extends Omit<
    InputHTMLAttributes<HTMLInputElement>,
    "size"
  > {
  label?: string;
  helperText?: string;
  error?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  inputSize?: InputSize;
}

const sizes = {
  sm: {
    wrapper: "h-11",
    input: "text-sm px-4",
  },
  md: {
    wrapper: "h-12",
    input: "text-base px-4",
  },
  lg: {
    wrapper: "h-14",
    input: "text-lg px-5",
  },
};

const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      helperText,
      error,
      leftIcon,
      rightIcon,
      inputSize = "md",
      className = "",
      disabled,
      ...props
    },
    ref
  ) => {
    const [focused, setFocused] = useState(false);

    const current = sizes[inputSize];

    return (
      <div
        className="w-full"
        data-aeonvera-input
        data-aeonvera-label="Input"
      >
        {label && (
          <label className="mb-2 block text-[11px] uppercase tracking-[0.32em] text-white/45">
            {label}
          </label>
        )}

        <motion.div
          animate={{
            scale: focused ? 1.01 : 1,
          }}
          transition={{
            duration: 0.14,
          }}
          className={`
            relative
            flex
            items-center
            rounded-2xl
            overflow-hidden
            border
            backdrop-blur-xl
            transition-all
            duration-200

            ${
              error
                ? "border-red-400/50"
                : focused
                ? "border-cyan-400/40"
                : "border-white/10 hover:border-white/20"
            }

            ${
              focused
                ? "bg-white/[0.07]"
                : "bg-white/[0.04]"
            }

            ${
              current.wrapper
            }

            ${
              disabled
                ? "opacity-50 cursor-not-allowed"
                : ""
            }
          `}
        >
          {/* Glow */}

          <div
            className={`
              absolute
              inset-0
              pointer-events-none
              transition-opacity
              duration-300

              ${
                focused
                  ? "opacity-100"
                  : "opacity-0"
              }

              bg-[radial-gradient(circle_at_center,rgba(34,211,238,0.12),transparent_70%)]
            `}
          />

          {leftIcon && (
            <div className="relative z-10 ml-4 text-white/45">
              {leftIcon}
            </div>
          )}

          <input
            ref={ref}
            disabled={disabled}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            {...props}
            className={`
              relative
              z-10
              flex-1
              h-full
              bg-transparent
              outline-none

              text-white
              placeholder:text-white/25

              ${current.input}

              ${leftIcon ? "pl-3" : ""}
              ${rightIcon ? "pr-3" : ""}

              ${className}
            `}
          />

          {rightIcon && (
            <div className="relative z-10 mr-4 text-white/45">
              {rightIcon}
            </div>
          )}
        </motion.div>

        {(helperText || error) && (
          <div
            className={`
              mt-2
              text-xs

              ${
                error
                  ? "text-red-400"
                  : "text-white/40"
              }
            `}
          >
            {error ?? helperText}
          </div>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";

export default Input;