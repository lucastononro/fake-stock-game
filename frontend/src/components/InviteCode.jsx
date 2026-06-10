import { useState } from "react";

export default function InviteCode({ code }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // clipboard unavailable (e.g. non-HTTPS); user can select manually
    }
  }

  return (
    <button className="invite-chip" onClick={copy} title="Copy invite code">
      <code>{code}</code>
      <span className="invite-action">{copied ? "Copied ✓" : "Copy"}</span>
    </button>
  );
}
