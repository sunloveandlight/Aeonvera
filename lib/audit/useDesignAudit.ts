"use client";

import { useEffect } from "react";

const SPACING_VIOLATIONS = ["mt-", "mb-", "pt-", "pb-", "px-", "py-"];

function scanElement(el: Element, violations: string[]) {
  const className = el.getAttribute("class") || "";

  // spacing rule check
  for (const rule of SPACING_VIOLATIONS) {
    if (className.includes(rule)) {
      violations.push(
        `Spacing violation → "${rule}" in <${el.tagName.toLowerCase()}>`
      );
      break;
    }
  }

  // raw input check
  if (el.tagName.toLowerCase() === "input") {
    const allowed = el.closest("[data-aeonvera-input]");
    if (!allowed) {
      violations.push(`Raw input usage → <input> outside Input component`);
    }
  }

  // raw button check
  if (el.tagName.toLowerCase() === "button") {
    const allowed = el.closest("[data-aeonvera-button]");
    if (!allowed) {
      violations.push(`Raw button usage → <button> outside Button component`);
    }
  }
}

function walkDOM(root: Element, violations: string[]) {
  scanElement(root, violations);

  const children = root.children;
  for (let i = 0; i < children.length; i++) {
    walkDOM(children[i], violations);
  }
}

export function useDesignAudit(enabled = true) {
  useEffect(() => {
    if (!enabled) return;

    const runAudit = () => {
      const violations: string[] = [];

      if (typeof document === "undefined") return;

      walkDOM(document.body, violations);

      if (violations.length > 0) {
        console.group("🚨 AEONVERA DESIGN SYSTEM VIOLATIONS");
        violations.forEach((v) => console.warn(v));
        console.groupEnd();
      } else {
        console.log("✅ Aeonvera UI Audit: Clean");
      }
    };

    const timer = setTimeout(runAudit, 1000);

    return () => clearTimeout(timer);
  }, [enabled]);
}