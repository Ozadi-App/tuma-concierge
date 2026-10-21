"use client";

import type { InputHTMLAttributes } from "react";

/**
 * On/off setting. A native checkbox exposed as role="switch", so labels,
 * Space-to-toggle, focus, forms and `onChange={(e) => …e.target.checked}`
 * all behave exactly as before; only the look changes (animated gold track).
 */
export function Switch({ className = "", ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "role">) {
  return <input {...props} type="checkbox" role="switch" className={`pb-switch ${className}`} />;
}
