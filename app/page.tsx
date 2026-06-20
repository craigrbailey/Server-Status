'use client';

import { useEffect, useState } from 'react';

interface CheckResult {
  ok: boolean;
  label: string;
  description: string;
}

interface StatusResult {
  serverName: string;
  checks: CheckResult[];
  checkedAt: string;
}

export default function StatusPage() {
  const [status, setStatus] = useState<StatusResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;

    const fetchStatus = async () => {
      try {
        const res = await fetch('/api/status');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: StatusResult = await res.json();
        if (!active) return;
        setStatus(data);
        setError(false);
      } catch (err) {
        console.error('Failed to fetch status:', err);
        if (active) setError(true);
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 30_000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  const allOk = status?.checks.every((c) => c.ok) ?? false;

  return (
    <main className="min-h-screen bg-[#1a1a1a] flex flex-col items-center justify-center px-4 py-16 selection:bg-[#E5A00D]/30">
      {/* Header */}
      <div className="text-center mb-12">
        <div className="flex items-center justify-center gap-3 mb-3">
          <PlexMark />
          <h1 className="text-3xl font-bold tracking-tight text-white">
            {status?.serverName ?? 'Plex Server'}
          </h1>
        </div>

        <p className="text-[#555] text-sm uppercase tracking-widest font-medium">
          Infrastructure Status
        </p>

        {/* Overall health badge */}
        {status && (
          <div
            className={`inline-flex items-center gap-2 mt-4 px-3 py-1 rounded-full text-xs font-semibold border ${
              allOk
                ? 'bg-[#22c55e]/10 border-[#22c55e]/25 text-[#22c55e]'
                : 'bg-[#ef4444]/10 border-[#ef4444]/25 text-[#ef4444]'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${allOk ? 'bg-[#22c55e]' : 'bg-[#ef4444]'}`}
            />
            {allOk ? 'All systems operational' : 'Issues detected'}
          </div>
        )}
      </div>

      {/* Status cards */}
      <div className="w-full max-w-xl space-y-3">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
        ) : !status ? (
          <div className="text-center py-12 text-[#555] text-sm">
            Could not reach the status API. Check server logs.
          </div>
        ) : (
          status.checks.map((check) => (
            <StatusCard key={check.label} check={check} />
          ))
        )}
      </div>

      {/* Footer: timestamp + stale-refresh warning */}
      {status && !loading && (
        <p className="mt-8 text-[#444] text-xs tabular-nums text-center">
          {error && (
            <span className="text-[#ef4444]/80">
              Couldn&apos;t refresh — showing last known status.
              <br />
            </span>
          )}
          Last checked at{' '}
          {new Date(status.checkedAt).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          })}{' '}
          · refreshes every 30s
        </p>
      )}
    </main>
  );
}

function StatusCard({ check }: { check: CheckResult }) {
  return (
    <div
      className={`flex items-center justify-between px-5 py-4 rounded-2xl border transition-colors ${
        check.ok
          ? 'bg-[#212121] border-[#2a2a2a] hover:border-[#333]'
          : 'bg-[#211c1c] border-[#2e1e1e] hover:border-[#3e2020]'
      }`}
    >
      <div className="flex items-center gap-4">
        <StatusIcon ok={check.ok} />
        <div>
          <p className="text-white font-semibold text-[0.95rem] leading-snug">
            {check.label}
          </p>
          <p className="text-[#666] text-xs mt-0.5 leading-relaxed max-w-xs">
            {check.description}
          </p>
        </div>
      </div>

      <span
        className={`text-xs font-bold tracking-wide ml-4 flex-shrink-0 ${
          check.ok ? 'text-[#22c55e]' : 'text-[#ef4444]'
        }`}
      >
        {check.ok ? 'OK' : 'DOWN'}
      </span>
    </div>
  );
}

function StatusIcon({ ok }: { ok: boolean }) {
  return (
    <div
      className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
        ok ? 'bg-[#22c55e]/15' : 'bg-[#ef4444]/15'
      }`}
    >
      {ok ? (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path
            d="M2.5 8.5L6 12L13.5 4"
            stroke="#22c55e"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path
            d="M4 4L12 12M12 4L4 12"
            stroke="#ef4444"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      )}
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="bg-[#212121] border border-[#2a2a2a] rounded-2xl px-5 py-4 flex items-center gap-4 animate-pulse">
      <div className="w-8 h-8 rounded-full bg-[#2a2a2a] flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-3.5 bg-[#2a2a2a] rounded w-32" />
        <div className="h-2.5 bg-[#252525] rounded w-56" />
      </div>
      <div className="h-3 bg-[#2a2a2a] rounded w-8" />
    </div>
  );
}

function PlexMark() {
  return (
    <svg
      width="32"
      height="32"
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M16 2L30 28H2L16 2Z" fill="#E5A00D" />
      <path d="M16 10L25 26H7L16 10Z" fill="#1a1a1a" opacity="0.65" />
    </svg>
  );
}
