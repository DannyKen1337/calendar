"use client";

// Gomb, ami elküldés előtt rákérdez (törléshez)
export default function ConfirmButton({ message, className, children }) {
  return <button className={className} onClick={(e) => { if (!window.confirm(message)) e.preventDefault(); }}>{children}</button>;
}
