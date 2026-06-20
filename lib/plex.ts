import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

const PLEX_HOST = process.env.PLEX_HOST ?? '';
const PLEX_PORT = process.env.PLEX_PORT ?? '32400';
const PLEX_TOKEN = process.env.PLEX_TOKEN ?? '';
const PLEX_SERVER_NAME = process.env.PLEX_SERVER_NAME ?? 'Plex Server';

// Allow only valid hostnames / IPv4 / IPv6 chars. Anything else is rejected
// before it can reach the shell — guards against command injection via env.
const HOST_PATTERN = /^[a-zA-Z0-9.\-:]+$/;

export interface CheckResult {
  ok: boolean;
  label: string;
  description: string;
}

export interface StatusResult {
  serverName: string;
  checks: CheckResult[];
  checkedAt: string;
}

// --- tiny terminal logger -------------------------------------------------
function log(message: string) {
  console.log(`[plex-status ${new Date().toISOString()}] ${message}`);
}
function warn(message: string) {
  console.warn(`[plex-status ${new Date().toISOString()}] ${message}`);
}
function describeError(err: unknown): string {
  if (err instanceof Error) {
    if (err.name === 'TimeoutError' || err.name === 'AbortError') {
      return 'request timed out';
    }
    return err.message;
  }
  return String(err);
}
// --------------------------------------------------------------------------

let cachedStatus: StatusResult | null = null;
let lastChecked = 0;
let inflight: Promise<StatusResult> | null = null;
const CACHE_TTL_MS = 30_000;

function plexUrl(path: string): string {
  return `http://${PLEX_HOST}:${PLEX_PORT}${path}?X-Plex-Token=${PLEX_TOKEN}`;
}

async function pingHost(): Promise<boolean> {
  if (!PLEX_HOST) {
    warn('Host check skipped — PLEX_HOST is not set');
    return false;
  }
  if (!HOST_PATTERN.test(PLEX_HOST)) {
    warn(`Host check failed — PLEX_HOST "${PLEX_HOST}" is not a valid host`);
    return false;
  }
  try {
    const isDarwin = process.platform === 'darwin';
    // execFile (no shell) — args are passed literally, never interpreted.
    const args = isDarwin
      ? ['-c', '1', '-t', '2', PLEX_HOST]
      : ['-c', '1', '-W', '2', PLEX_HOST];
    await execFileAsync('ping', args);
    return true;
  } catch (err) {
    warn(`Host check failed — ${describeError(err)}`);
    return false;
  }
}

async function checkPlexApp(): Promise<boolean> {
  if (!PLEX_HOST || !PLEX_TOKEN) {
    warn('Plex App check skipped — PLEX_HOST or PLEX_TOKEN is not set');
    return false;
  }
  try {
    const res = await fetch(plexUrl('/identity'), {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      warn(`Plex App check failed — HTTP ${res.status} from /identity`);
      return false;
    }
    return true;
  } catch (err) {
    warn(`Plex App check failed — ${describeError(err)}`);
    return false;
  }
}

async function checkRemoteAccess(): Promise<boolean> {
  if (!PLEX_HOST || !PLEX_TOKEN) {
    warn('Remote Access check skipped — PLEX_HOST or PLEX_TOKEN is not set');
    return false;
  }
  try {
    const res = await fetch(plexUrl('/myplex/account'), {
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      warn(`Remote Access check failed — HTTP ${res.status} from /myplex/account`);
      return false;
    }
    const text = await res.text();
    // mappingState="mapped" means NAT traversal is working for direct external connections
    const mapped =
      text.includes('mappingState="mapped"') ||
      text.includes('"mappingState":"mapped"');
    if (!mapped) {
      warn('Remote Access check failed — port mapping is not "mapped"');
    }
    return mapped;
  } catch (err) {
    warn(`Remote Access check failed — ${describeError(err)}`);
    return false;
  }
}

async function checkDataAccess(): Promise<boolean> {
  if (!PLEX_HOST || !PLEX_TOKEN) {
    warn('Media Library check skipped — PLEX_HOST or PLEX_TOKEN is not set');
    return false;
  }
  try {
    const res = await fetch(plexUrl('/library/sections/1'), {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      warn(`Media Library check failed — HTTP ${res.status} from /library/sections/1`);
      return false;
    }
    const data = await res.json();
    const size = data?.MediaContainer?.size;
    if (typeof size !== 'number') {
      warn('Media Library check failed — no "size" field in response');
      return false;
    }
    if (size <= 0) {
      warn('Media Library check failed — section 1 has 0 items (storage may be unmounted)');
      return false;
    }
    return true;
  } catch (err) {
    warn(`Media Library check failed — ${describeError(err)}`);
    return false;
  }
}

async function runChecks(): Promise<StatusResult> {
  log('Running Plex status checks...');
  const [hostOk, appOk, remoteOk, dataOk] = await Promise.all([
    pingHost(),
    checkPlexApp(),
    checkRemoteAccess(),
    checkDataAccess(),
  ]);

  const result: StatusResult = {
    serverName: PLEX_SERVER_NAME,
    checks: [
      {
        ok: hostOk,
        label: 'Host',
        description: 'Plex server machine is reachable via ICMP ping',
      },
      {
        ok: appOk,
        label: 'Plex App',
        description: 'Plex Media Server process is running and responding',
      },
      {
        ok: remoteOk,
        label: 'Remote Access',
        description: 'Port mapping is active for external connections',
      },
      {
        ok: dataOk,
        label: 'Media Library',
        description: 'Library section 1 has accessible items — storage is mounted',
      },
    ],
    checkedAt: new Date().toISOString(),
  };

  const passed = result.checks.filter((c) => c.ok).length;
  log(`Checks complete — ${passed}/${result.checks.length} healthy`);
  return result;
}

export async function getPlexStatus(): Promise<StatusResult> {
  const now = Date.now();
  if (cachedStatus && now - lastChecked < CACHE_TTL_MS) {
    return cachedStatus;
  }

  // If a check run is already underway, reuse it instead of starting another
  // (prevents multiple tabs from each triggering a full run when cache expires).
  if (inflight) {
    return inflight;
  }

  inflight = runChecks()
    .then((result) => {
      cachedStatus = result;
      lastChecked = Date.now();
      return result;
    })
    .finally(() => {
      inflight = null;
    });

  return inflight;
}
