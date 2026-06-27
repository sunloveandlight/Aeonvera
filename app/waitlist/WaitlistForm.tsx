"use client";

import { FormEvent, useState } from "react";
import { ArrowRight, Check, Mail, User } from "lucide-react";

type Status = "idle" | "submitting" | "success" | "error";

export default function WaitlistForm() {
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("submitting");
    setMessage("");

    try {
      const response = await fetch("/api/waitlist", {
        body: JSON.stringify({
          email,
          firstName,
          sourcePath: window.location.pathname,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || "Could not join the list.");
      }

      setStatus("success");
      setMessage("You are on the list. We will email you when Aeonvera opens.");
      setEmail("");
      setFirstName("");
    } catch (error) {
      setStatus("error");
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not join the list. Please try again."
      );
    }
  }

  const disabled = status === "submitting";

  return (
    <form onSubmit={handleSubmit} className="waitlist-form">
      <div className="waitlist-form-grid">
        <div className="waitlist-field">
          <User aria-hidden size={18} />
          <label className="sr-only" htmlFor="waitlist-first-name">
            First name
          </label>
          <input
            autoComplete="given-name"
            id="waitlist-first-name"
            maxLength={80}
            name="firstName"
            onChange={(event) => setFirstName(event.target.value)}
            placeholder="First name"
            value={firstName}
          />
        </div>

        <div className="waitlist-field">
          <Mail aria-hidden size={18} />
          <label className="sr-only" htmlFor="waitlist-email">
            Email
          </label>
          <input
            autoComplete="email"
            id="waitlist-email"
            inputMode="email"
            maxLength={320}
            name="email"
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Email address"
            required
            type="email"
            value={email}
          />
        </div>

        <button className="waitlist-submit" disabled={disabled} type="submit">
          <span>{disabled ? "Joining" : "Join the list"}</span>
          {status === "success" ? <Check size={18} /> : <ArrowRight size={18} />}
        </button>
      </div>

      <p
        className={`waitlist-form-note ${status === "error" ? "is-error" : ""}`}
        role={status === "error" ? "alert" : "status"}
      >
        {message || "No spam. Just your invite, founder perks, and launch notes."}
      </p>
    </form>
  );
}
