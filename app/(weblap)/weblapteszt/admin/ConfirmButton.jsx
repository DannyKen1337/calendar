"use client";

// Gomb, ami elküldés előtt rákérdez (törléshez)
export default function ConfirmButton({ message, className, children, ...rest }) {
  return <button className={className} {...rest} onClick={(e) => { if (!window.confirm(message)) e.preventDefault(); }}>{children}</button>;
}
