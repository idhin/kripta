"use client";

import { forwardRef, useState } from "react";
import { EyeIcon, EyeOffIcon } from "@/components/icons";
import { useT } from "@/lib/i18n";

export const PasswordInput = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function PasswordInput({ className = "", ...props }, ref) {
    const t = useT();
    const [show, setShow] = useState(false);
    return (
      <div className="relative">
        <input
          ref={ref}
          type={show ? "text" : "password"}
          className={`h-11 w-full rounded-xl border border-line/80 bg-surface-2/60 pl-3.5 pr-11 text-sm text-fg outline-none transition placeholder:text-muted/60 focus:border-glow/60 focus:bg-surface-2/90 focus:ring-4 focus:ring-glow/15 ${className}`}
          {...props}
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setShow((v) => !v)}
          className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-muted hover:text-fg"
          aria-label={show ? t("password.hide") : t("password.show")}
        >
          {show ? <EyeOffIcon width={18} height={18} /> : <EyeIcon width={18} height={18} />}
        </button>
      </div>
    );
  }
);
