"use client";

import React from "react";

type Props = {
  email: string;
  onEmailChange: (value: string) => void;
  onPasskey: () => Promise<void> | void;
  onRegister?: () => Promise<void> | void;
  loading?: boolean;
  message?: string | null;
};

export default function AuthForm({
  email,
  onEmailChange,
  onPasskey,
  onRegister,
  loading = false,
  message,
}: Props) {
  return (
    <main style={{ padding: 24, display: "flex", justifyContent: "center" }}>
      <div
        style={{
          width: "100%",
          maxWidth: 520,
          background: "linear-gradient(180deg,#f6fbff, #ffffff)",
          border: "1px solid #dbeeff",
          borderRadius: 12,
          padding: 24,
          boxShadow: "0 8px 30px rgba(14,42,80,0.06)",
        }}
      >
        <h1 style={{ margin: 0, marginBottom: 8, color: "#0f172a", fontSize: 22 }}>Sign in</h1>
        <p style={{ marginTop: 0, marginBottom: 18, color: "#1e40af" }}>Use your email and a passkey to sign in</p>

        <label style={{ display: "block", marginBottom: 12, color: "#0f172a" }}>
          <div style={{ marginBottom: 6, fontSize: 14 }}>Email</div>
          <input
            type="email"
            value={email}
            onChange={(e) => onEmailChange(e.target.value)}
            placeholder="you@example.com"
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: 8,
              border: "1px solid #cfe4ff",
              background: "#fff",
              outline: "none",
              fontSize: 14,
            }}
          />
        </label>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button
            onClick={onPasskey}
            disabled={loading}
            style={{
              flex: 1,
              padding: "10px 14px",
              background: "#0ea5e9",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              cursor: "pointer",
              fontWeight: 600,
              boxShadow: "inset 0 -2px 0 rgba(0,0,0,0.08)",
            }}
          >
            {loading ? "Please wait..." : "Sign in with Passkey"}
          </button>

          {onRegister && (
            <button
              onClick={onRegister}
              disabled={loading}
              style={{
                padding: "10px 12px",
                background: "#eef6ff",
                color: "#0f172a",
                border: "1px solid #cfe4ff",
                borderRadius: 8,
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              Register
            </button>
          )}
        </div>

        {message && <div style={{ marginTop: 12, color: "#0369a1" }}>{message}</div>}
      </div>
    </main>
  );
}
