import type { CSSProperties } from "react";

/** The proxied image URL for a member's photo, or undefined for initials.
 *  The ?v= (derived from the object key, which changes on every upload) busts
 *  the browser cache when someone swaps their picture. */
export function avatarSrc(u: { id: string; avatar?: string } | null | undefined): string | undefined {
  if (!u?.avatar) return undefined;
  const v = u.avatar.replace(/[^a-z0-9]/gi, "").slice(-10);
  return `/api/avatar?u=${encodeURIComponent(u.id)}&v=${v}`;
}

export function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/** A person's display picture — their uploaded photo, or coloured initials. */
export default function Avatar({
  name,
  color,
  src,
  size,
  className = "",
  style,
  title,
}: {
  name: string;
  color?: string;
  src?: string;
  size?: "sm" | "lg" | "xl";
  className?: string;
  style?: CSSProperties;
  title?: string;
}) {
  const cls = `avatar${size ? " " + size : ""}${className ? " " + className : ""}`;
  if (src) {
    return (
      <div className={cls} style={{ background: "var(--line, #eee)", ...style }} title={title}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={name} />
      </div>
    );
  }
  return (
    <div className={cls} style={{ background: color || "#7178DD", ...style }} title={title}>
      {initials(name)}
    </div>
  );
}
