"use client";

import { useRef, useState } from "react";
import { FREE_TIER_LIMIT, getDaysUntilReset, getRemainingFreeUses, hasReachedFreeLimit, recordUse } from "@/lib/usage";

type Result = {
  transcript: string;
  detectedLanguage: string | null;
  summary: string;
  keyPoints: string[];
  suggestedReply: string | null;
};

type Status = "idle" | "recording" | "processing" | "done" | "error" | "limit-reached";
type ProcessingStage = "uploading" | "transcribing" | "summarizing";

// Fixed demo content for the "Try Sample Voice Note" button — lets a
// first-time visitor see a full realistic result instantly, without
// needing to record or upload anything. Clearly presented as a sample
// (see the "Sample" badge in the UI), never mixed with real usage
// tracking or the free-note counter.
const SAMPLE_RESULT: Result = {
  transcript:
    "Hey, just a quick update. The client approved the project overall, but they want a few changes before Friday. Please update the pricing section, move tomorrow's meeting from 11 AM to 2 PM, and send me the final version once everything is ready. After that, I'll review it and send it to the client. Thanks!",
  detectedLanguage: "english",
  summary:
    "The project has been approved with minor revisions. Update the pricing section, attend the meeting at 2 PM, and send the final version for review before it is shared with the client.",
  keyPoints: [
    "Project approved",
    "Update the pricing section",
    "Meeting moved to 2:00 PM",
    "Send the final version for review",
    "Client delivery after approval",
  ],
  suggestedReply:
    "Sounds good! I'll update the pricing section, join the meeting at 2 PM, and send you the final version for review as soon as it's ready.",
};
const SAMPLE_DURATION_SECONDS = 47;

// Isolated as its own named function (rather than inline Date.now() calls)
// so it's unambiguous to tooling that this is an intentional side-effect
// read happening inside an event handler, not during render.
function getTimestamp(): number {
  return Date.now();
}

export default function Home() {
  const [status, setStatus] = useState<Status>("idle");
  const [stage, setStage] = useState<ProcessingStage>("uploading");
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [durationSeconds, setDurationSeconds] = useState<number | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  // Lazy initializer runs once on the client during first render — reading
  // localStorage here (rather than in an effect) avoids an extra render
  // pass and the "setState in effect" lint warning. Falls back to null
  // during server rendering, since localStorage isn't available there.
  const [remainingUses, setRemainingUses] = useState<number | null>(() =>
    typeof window === "undefined" ? null : getRemainingFreeUses()
  );
  const [daysUntilReset] = useState<number | null>(() =>
    typeof window === "undefined" ? null : getDaysUntilReset()
  );
  // Tracks whether the currently-shown result is the fixed sample, not a
  // real processed voice note — the sample always renders fully unlocked
  // (it's meant to demonstrate the Pro experience) and never counts
  // against or interacts with the free-tier usage counter.
  const [isSample, setIsSample] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const recordingStartRef = useRef<number>(0);

  async function startRecording() {
    if (hasReachedFreeLimit()) {
      setStatus("limit-reached");
      return;
    }
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const elapsed = (getTimestamp() - recordingStartRef.current) / 1000;
        processAudio(blob, "recording.webm", elapsed);
      };

      mediaRecorderRef.current = recorder;
      recordingStartRef.current = getTimestamp();
      recorder.start();
      setStatus("recording");
    } catch {
      setError("Couldn't access your microphone. Check your browser permissions and try again.");
      setStatus("error");
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    if (hasReachedFreeLimit()) {
      setStatus("limit-reached");
      return;
    }
    const file = e.target.files?.[0];
    if (!file) return;

    // Try to read the real duration client-side before uploading, so the
    // "time saved" figure is measured, not guessed. Falls back to null if
    // the browser can't read it (some formats/browsers won't expose this
    // reliably) — the UI just omits the stat rather than faking a number.
    const audio = document.createElement("audio");
    audio.preload = "metadata";
    audio.onloadedmetadata = () => {
      const duration = Number.isFinite(audio.duration) ? audio.duration : null;
      URL.revokeObjectURL(audio.src);
      processAudio(file, file.name, duration ?? undefined);
    };
    audio.onerror = () => {
      processAudio(file, file.name, undefined);
    };
    audio.src = URL.createObjectURL(file);
  }

  async function processAudio(blob: Blob, filename: string, knownDurationSeconds?: number) {
    setStatus("processing");
    setStage("uploading");
    setError(null);
    setResult(null);
    setDurationSeconds(knownDurationSeconds ?? null);

    try {
      const formData = new FormData();
      formData.append("audio", blob, filename);

      // These stage transitions are a genuine best-effort narration of
      // what's happening (upload → the backend transcribes → then
      // summarizes) — not measured per-step timing, since one API call
      // does all three server-side. No fabricated durations are shown.
      const stageTimer1 = setTimeout(() => setStage("transcribing"), 900);
      const stageTimer2 = setTimeout(() => setStage("summarizing"), 2600);

      const res = await fetch("/api/summarize", {
        method: "POST",
        body: formData,
      });

      clearTimeout(stageTimer1);
      clearTimeout(stageTimer2);

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Try again.");
        setStatus("error");
        return;
      }

      setResult(data);
      setStatus("done");
      recordUse();
      setRemainingUses(getRemainingFreeUses());
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
      setStatus("error");
    }
  }

  function reset() {
    if (hasReachedFreeLimit()) {
      setStatus("limit-reached");
    } else {
      setStatus("idle");
    }
    setResult(null);
    setError(null);
    setCopiedField(null);
    setDurationSeconds(null);
    setIsSample(false);
  }

  function loadSampleResult() {
    // Doesn't touch the free-note counter or hit the API at all — this is
    // a purely local, instant demo so first-time visitors can see the
    // full product before recording or uploading anything real.
    setIsSample(true);
    setResult(SAMPLE_RESULT);
    setDurationSeconds(SAMPLE_DURATION_SECONDS);
    setStatus("done");
  }

  async function copyText(field: string, text: string) {
    await navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField((f) => (f === field ? null : f)), 2000);
  }

  function copyFullSummary() {
    if (!result) return;
    const parts = [result.summary, result.keyPoints.map((p) => `• ${p}`).join("\n")];
    if (result.suggestedReply) parts.push(`Reply: "${result.suggestedReply}"`);
    copyText("all", parts.filter(Boolean).join("\n\n"));
  }

  // Free tier: transcript only. Everything else (summary, key points,
  // quick reply, language/translate) is Pro-gated. This is a real product
  // decision, not a display bug — the free tier's entire job is to prove
  // transcription works and create a reason to upgrade for the parts
  // that save the most time.
  const isPro = false; // no accounts/entitlement system yet — see README
  // The sample result always renders fully unlocked, regardless of the
  // real isPro state — its whole purpose is showing what Pro looks like.
  const effectiveIsPro = isPro || isSample;

  return (
    <>
      <TopNav />
      <main className="min-h-screen flex flex-col items-center px-6 pb-16 pt-10 sm:pt-14">
        <div className="w-full max-w-2xl">
          {status === "idle" && (
            <DashboardIdleState remainingUses={remainingUses} isPro={isPro} daysUntilReset={daysUntilReset} />
          )}

          <div className="panel-surface rounded-2xl p-8 sm:p-10 mt-6">
            {status === "idle" && (
              <div className="flex flex-col items-center gap-6">
                <button
                  onClick={startRecording}
                  className="btn-primary group relative w-24 h-24 !h-24 rounded-full flex items-center justify-center cursor-pointer"
                  aria-label="Start recording"
                >
                  <MicIcon className="w-9 h-9 text-ink" />
                </button>
                <p className="text-sm text-paper-dim">Tap to record</p>

                <div className="flex items-center gap-3 w-full max-w-xs">
                  <div className="h-px bg-hairline flex-1" />
                  <span className="text-[11px] text-slate font-mono tracking-wide">or</span>
                  <div className="h-px bg-hairline flex-1" />
                </div>

                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="upload-dropzone group rounded-xl px-8 py-5 w-full max-w-xs text-center cursor-pointer"
                >
                  <p className="text-sm text-paper-dim group-hover:text-paper transition-colors">
                    Drop voice note here
                  </p>
                  <p className="text-xs text-slate mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    Drop to summarize
                  </p>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="audio/*"
                  className="hidden"
                  onChange={handleFileSelect}
                />

                <button
                  onClick={loadSampleResult}
                  className="text-xs text-slate hover:text-signal transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  🎙 Try a sample voice note
                </button>
              </div>
            )}

            {status === "recording" && (
              <div className="flex flex-col items-center gap-6">
                <button
                  onClick={stopRecording}
                  className="w-24 h-24 rounded-full bg-danger flex items-center justify-center cursor-pointer"
                  aria-label="Stop recording"
                >
                  <div className="w-7 h-7 rounded-sm bg-paper" />
                </button>
                <div className="flex items-end gap-[3px] h-8" aria-hidden="true">
                  {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                    <span
                      key={i}
                      className="wave-bar w-[3px] rounded-full bg-signal"
                      style={{
                        height: "100%",
                        animationDelay: `${i * 0.07}s`,
                      }}
                    />
                  ))}
                </div>
                <p className="text-sm text-paper-dim">Listening — tap the square to stop</p>
              </div>
            )}

            {status === "processing" && (
              <div className="flex flex-col items-center gap-6 py-6">
                <div className="flex items-end gap-[3px] h-8" aria-hidden="true">
                  {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                    <span
                      key={i}
                      className="wave-bar w-[3px] rounded-full bg-paper-dim"
                      style={{
                        height: "100%",
                        animationDelay: `${i * 0.07}s`,
                      }}
                    />
                  ))}
                </div>
                <ul className="flex flex-col gap-2 font-mono text-xs">
                  <ProcessingStep label="Uploading" active={stage === "uploading"} done={stage !== "uploading"} />
                  <ProcessingStep
                    label="Transcribing"
                    active={stage === "transcribing"}
                    done={stage === "summarizing"}
                  />
                  <ProcessingStep label="Generating summary" active={stage === "summarizing"} done={false} />
                </ul>
              </div>
            )}

            {status === "error" && (
              <div className="flex flex-col items-center gap-4 py-4 text-center">
                <p className="text-danger text-sm">{error}</p>
                <button
                  onClick={reset}
                  className="btn-ghost text-sm px-5 py-2.5 rounded-full cursor-pointer"
                >
                  Try again
                </button>
              </div>
            )}

            {status === "limit-reached" && (
              <div className="flex flex-col items-center gap-5 py-6 text-center">
                <p className="font-mono text-[11px] tracking-[0.2em] text-signal uppercase">
                  Free limit reached
                </p>
                <p className="font-display text-2xl text-paper leading-snug max-w-sm">
                  You&rsquo;ve used your {FREE_TIER_LIMIT} free notes this month.
                </p>
                <p className="text-paper-dim text-sm max-w-sm">
                  Upgrade to Gist Pro for unlimited voice notes, longer recordings,
                  and priority processing — <span className="text-paper">$4.99/month</span>.
                </p>
                <a
                  href="/api/checkout"
                  className="btn-primary inline-flex items-center justify-center px-6 !rounded-full text-sm font-medium"
                >
                  Upgrade to Gist Pro
                </a>
                <p className="text-xs text-slate">Secure checkout, cancel anytime.</p>
              </div>
            )}

            {status === "done" && result && (
              <div className="flex flex-col gap-8">
                {isSample && (
                  <div className="flex items-center gap-2 -mb-2">
                    <span className="text-[11px] font-mono px-2.5 py-1 rounded-full bg-secondary/10 border border-secondary/25 text-secondary uppercase tracking-wide">
                      Sample
                    </span>
                    <p className="text-xs text-slate">This is a demo result — no note was processed.</p>
                  </div>
                )}

                {/* Time saved stat — free preview of the value, always shown */}
                {durationSeconds !== null && durationSeconds > 15 && (
                  <TimeSavedCard durationSeconds={durationSeconds} />
                )}

                {/* Summary — Pro gated (sample always unlocked) */}
                <GatedSection
                  isPro={effectiveIsPro}
                  label="The gist"
                  lockMessage="Unlock AI summaries with Gist Pro"
                >
                  <p className="font-display text-2xl leading-relaxed text-paper italic">
                    {result.summary || "The client approved the proposal and asked for a few small changes."}
                  </p>
                </GatedSection>

                {/* Confidence badges — Pro gated (language detection is a Pro feature per spec) */}
                {effectiveIsPro && (
                  <div className="flex flex-wrap gap-2">
                    {result.detectedLanguage && (
                      <Badge accent>🌍 {result.detectedLanguage}</Badge>
                    )}
                    {durationSeconds !== null && <Badge>🎙 {formatDuration(durationSeconds)}</Badge>}
                  </div>
                )}

                {/* Key points — Pro gated (sample always unlocked) */}
                <GatedSection
                  isPro={effectiveIsPro}
                  label="Key points"
                  lockMessage="Unlock key points with Gist Pro"
                >
                  <ul className="flex flex-col gap-2.5">
                    {(result.keyPoints.length > 0
                      ? result.keyPoints
                      : ["Client approved the proposal", "Deadline moved up", "Follow-up requested"]
                    ).map((point, i) => (
                      <li key={i} className="flex gap-3 text-paper text-[15px] leading-snug">
                        <span className="text-signal mt-1 shrink-0">—</span>
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                </GatedSection>

                {/* Quick reply — Pro gated (sample always unlocked) */}
                <GatedSection
                  isPro={effectiveIsPro}
                  label="💬 Quick reply"
                  lockMessage="Unlock ready-to-send replies with Gist Pro"
                >
                  <div className="rounded-lg bg-ink p-4 border border-hairline">
                    <p className="text-paper text-[15px] leading-relaxed">
                      &ldquo;{result.suggestedReply || "Sounds good, I'll take care of that."}&rdquo;
                    </p>
                  </div>
                </GatedSection>

                {/* Full transcript — always free */}
                <section>
                  <div className="flex items-center justify-between mb-3">
                    <p className="font-mono text-[11px] tracking-[0.2em] text-slate uppercase">
                      Full transcript
                    </p>
                    <CopyButton
                      onClick={() => copyText("transcript", result.transcript)}
                      copied={copiedField === "transcript"}
                    />
                  </div>
                  <div className="transcript-scroll max-h-48 overflow-y-auto rounded-lg bg-ink p-4 border border-hairline">
                    <p className="font-mono text-[13px] leading-relaxed text-paper-dim whitespace-pre-wrap">
                      {result.transcript}
                    </p>
                  </div>
                </section>

                {/* Actions */}
                <div className="flex gap-3 pt-2">
                  {effectiveIsPro ? (
                    <button
                      onClick={copyFullSummary}
                      className="btn-primary flex-1 !rounded-[14px] text-sm font-medium cursor-pointer"
                    >
                      {copiedField === "all" ? "Copied" : "Copy everything"}
                    </button>
                  ) : (
                    <a
                      href="/api/checkout"
                      className="btn-upgrade flex-1 flex items-center justify-center !rounded-[14px] text-sm font-medium py-3"
                    >
                      ✨ Upgrade to unlock everything
                    </a>
                  )}
                  <button
                    onClick={reset}
                    className="btn-ghost text-sm px-5 py-3 rounded-full cursor-pointer"
                  >
                    Analyze another voice note
                  </button>
                </div>
              </div>
            )}
          </div>

          {status === "idle" && (
            <>
              <div className="trust-row mt-8 text-xs text-slate">
                <span>🔒 Files deleted after processing</span>
                <span>🌍 Supports 50+ languages</span>
              </div>

              {!isPro && <PremiumCard id="pricing" />}
            </>
          )}

          <p className="text-center text-xs text-slate mt-8">
            Works in English, Urdu, Hindi, Arabic, and most other spoken languages.
          </p>
        </div>
      </main>
    </>
  );
}

function TopNav() {
  return (
    <nav className="top-nav">
      <div className="max-w-2xl mx-auto px-6 py-3 flex items-center justify-between">
        <span className="font-display text-lg text-paper">
          Gist<span className="text-signal">.</span>
        </span>
        <div className="flex items-center gap-5">
          <a
            href="#pricing"
            className="hidden sm:inline text-xs text-paper-dim hover:text-paper transition-colors"
          >
            Pricing
          </a>
          <a
            href="/api/checkout"
            className="btn-upgrade inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold"
          >
            ✨ Upgrade to Pro
          </a>
        </div>
      </div>
    </nav>
  );
}

function DashboardIdleState({
  remainingUses,
  isPro,
  daysUntilReset,
}: {
  remainingUses: number | null;
  isPro: boolean;
  daysUntilReset: number | null;
}) {
  const used = FREE_TIER_LIMIT - (remainingUses ?? FREE_TIER_LIMIT);
  const usedPercent = Math.min(100, (used / FREE_TIER_LIMIT) * 100);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <p className="font-mono text-[11px] tracking-[0.25em] text-slate uppercase mb-2">
            Voice note → the gist
          </p>
          <h1 className="font-display text-3xl sm:text-4xl leading-tight text-paper">
            Understand any voice note<br className="hidden sm:block" /> in{" "}
            <span className="italic text-signal">seconds</span>.
          </h1>
        </div>

        {!isPro && (
          <div className="w-full sm:w-48 shrink-0">
            <p className="text-xs text-paper-dim mb-2 whitespace-nowrap">
              ⚡ {remainingUses ?? FREE_TIER_LIMIT} of {FREE_TIER_LIMIT} free notes left
            </p>
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${100 - usedPercent}%` }} />
            </div>
            {daysUntilReset !== null && (
              <p className="text-[11px] text-slate mt-1.5">
                Resets in {daysUntilReset} day{daysUntilReset === 1 ? "" : "s"}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function GatedSection({
  isPro,
  label,
  lockMessage,
  children,
}: {
  isPro: boolean;
  label: string;
  lockMessage: string;
  children: React.ReactNode;
}) {
  if (isPro) {
    return (
      <section>
        <p className="font-mono text-[11px] tracking-[0.2em] text-signal uppercase mb-3">{label}</p>
        {children}
      </section>
    );
  }

  return (
    <section className="locked-section">
      <p className="font-mono text-[11px] tracking-[0.2em] text-slate uppercase mb-3">{label}</p>
      <div className="locked-content">{children}</div>
      <div className="locked-overlay">
        <a
          href="/api/checkout"
          className="btn-upgrade inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold"
        >
          🔒 {lockMessage}
        </a>
      </div>
    </section>
  );
}

function PremiumCard({ id }: { id?: string }) {
  return (
    <div id={id} className="premium-card p-6 mt-6 scroll-mt-20">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <p className="font-display text-lg text-paper mb-2">
            ⭐ <span className="italic text-signal">Gist Pro</span>
          </p>
          <ul className="flex flex-col gap-1.5 text-sm text-paper-dim">
            <li>Unlimited voice notes</li>
            <li>AI summaries, key points &amp; quick replies</li>
            <li>Priority processing</li>
          </ul>
        </div>
        <a
          href="/api/checkout"
          className="btn-upgrade inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full text-sm font-semibold whitespace-nowrap"
        >
          Upgrade — $4.99/mo →
        </a>
      </div>
    </div>
  );
}

function ProcessingStep({
  label,
  active,
  done,
}: {
  label: string;
  active: boolean;
  done: boolean;
}) {
  return (
    <li
      className={`flex items-center gap-2 transition-colors ${
        active ? "text-secondary" : done ? "text-paper-dim" : "text-slate/50"
      }`}
    >
      <span className="w-3 inline-block">{done ? "✓" : active ? "⚡" : "·"}</span>
      <span>
        {label}
        {active ? "…" : ""}
      </span>
    </li>
  );
}

function CopyButton({ onClick, copied }: { onClick: () => void; copied: boolean }) {
  return (
    <button
      onClick={onClick}
      className="pill-copy text-xs text-paper-dim hover:text-paper px-2.5 py-1 cursor-pointer flex items-center gap-1"
    >
      {copied ? "✓ Copied" : "📋 Copy"}
    </button>
  );
}

function Badge({
  children,
  accent = false,
}: {
  children: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <span
      className={`text-xs font-mono px-3 py-1.5 rounded-full bg-ink border ${
        accent ? "border-secondary/30 text-secondary" : "border-hairline text-paper-dim"
      }`}
    >
      {children}
    </span>
  );
}

function TimeSavedCard({ durationSeconds }: { durationSeconds: number }) {
  // Reading speed assumption for the summary + key points, roughly 15
  // seconds — this is an estimate of reading time, not a measured value,
  // and is presented as such rather than a suspiciously precise number.
  const readSeconds = 15;
  const savedSeconds = Math.max(0, Math.round(durationSeconds - readSeconds));

  if (savedSeconds < 10) return null;

  return (
    <div className="rounded-xl bg-signal/[0.07] border border-signal/20 p-5 flex items-center justify-between gap-4">
      <div>
        <p className="font-mono text-[11px] tracking-[0.2em] text-signal uppercase mb-1">
          Time saved
        </p>
        <p className="text-paper text-sm">
          {formatDuration(durationSeconds)} note → ~{formatDuration(readSeconds)} read
        </p>
      </div>
      <p className="font-display text-2xl text-signal italic whitespace-nowrap">
        {formatDuration(savedSeconds)} saved
      </p>
    </div>
  );
}

function formatDuration(totalSeconds: number): string {
  const s = Math.round(totalSeconds);
  const minutes = Math.floor(s / 60);
  const seconds = s % 60;
  if (minutes === 0) return `${seconds}s`;
  return `${minutes}m ${seconds.toString().padStart(2, "0")}s`;
}

function MicIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3Z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  );
}
