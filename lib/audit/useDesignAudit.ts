"use client";

import { useEffect } from "react";

export type DesignAuditIssue = {
  category: string;
  message: string;
  severity: "info" | "warning" | "error";
};

export function useDesignAudit(enabled = false) {
  useEffect(() => {
    if (!enabled) return;

    const issues: DesignAuditIssue[] = [];
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    document.querySelectorAll<HTMLElement>("button, a, input, select, textarea").forEach((element) => {
      const rect = element.getBoundingClientRect();

      if (rect.width > 0 && rect.height > 0 && rect.width < 32 && rect.height < 32) {
        issues.push({
          category: "interaction",
          message: `Small tap target: ${element.tagName.toLowerCase()} ${element.textContent?.trim().slice(0, 40) || element.getAttribute("aria-label") || ""}`,
          severity: "warning",
        });
      }
    });

    document.querySelectorAll<HTMLElement>("[data-aeonvera-card]").forEach((card) => {
      const rect = card.getBoundingClientRect();

      if (rect.right > viewportWidth + 1 || rect.left < -1) {
        issues.push({
          category: "layout",
          message: `Card overflows viewport horizontally by ${Math.round(Math.max(rect.right - viewportWidth, -rect.left))}px.`,
          severity: "error",
        });
      }
    });

    document.querySelectorAll<HTMLElement>("h1, h2, h3, p, span, button, a").forEach((node) => {
      const rect = node.getBoundingClientRect();
      const style = window.getComputedStyle(node);

      if (
        rect.width > 0 &&
        rect.height > 0 &&
        rect.top < viewportHeight &&
        rect.bottom > 0 &&
        style.overflow !== "hidden" &&
        node.scrollWidth > node.clientWidth + 2
      ) {
        issues.push({
          category: "typography",
          message: `Text may be clipped: "${node.textContent?.trim().slice(0, 54)}"`,
          severity: "warning",
        });
      }
    });

    if (issues.length === 0) {
      console.info("Aeonvera Design Audit: no issues detected.");
      return;
    }

    console.group("Aeonvera Design Audit");

    issues.forEach((issue) => {
      const prefix =
        issue.severity === "error"
          ? "ERROR"
          : issue.severity === "warning"
          ? "WARN"
          : "INFO";

      console.log(
        `${prefix} [${issue.category}] ${issue.message}`
      );
    });

    console.groupEnd();
  }, [enabled]);
}
