/**
 * Real git state of the agent's workspace: branches, HEAD, dirty flag, recent
 * commits, checkout and commit — all through the bridge's `git` endpoints, so
 * every surface that shows branches agrees on one source of truth.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import {
  checkoutGitBranch,
  commitGitChanges,
  fetchGitLog,
  fetchGitSnapshot,
  type GitCommitEntry,
  type GitSnapshot,
} from "../omp/cli";

export interface GitRepoApi {
  snapshot: GitSnapshot | null;
  commits: GitCommitEntry[];
  error: string | null;
  loading: boolean;
  /** Set while a checkout/commit is running (holds the branch name or "commit"). */
  busy: string | null;
  refresh: () => Promise<void>;
  checkout: (branch: string) => Promise<boolean>;
  commit: (message: string) => Promise<boolean>;
}

export function useGitRepo(): GitRepoApi {
  const [snapshot, setSnapshot] = useState<GitSnapshot | null>(null);
  const [commits, setCommits] = useState<GitCommitEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    try {
      const [next, log] = await Promise.all([fetchGitSnapshot(), fetchGitLog(10)]);
      if (!mountedRef.current) return;
      setSnapshot(next);
      setCommits(log.commits);
      setError(null);
    } catch (err) {
      if (mountedRef.current) setError(err instanceof Error ? err.message : String(err));
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    // Another process (the agent, a terminal) can switch branches at any time.
    const timer = window.setInterval(() => void refresh(), 20_000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const checkout = useCallback(
    async (branch: string) => {
      setBusy(branch);
      setError(null);
      try {
        const next = await checkoutGitBranch(branch);
        setSnapshot(next);
        const log = await fetchGitLog(10).catch(() => null);
        if (log) setCommits(log.commits);
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        return false;
      } finally {
        setBusy(null);
      }
    },
    []
  );

  const commit = useCallback(async (message: string) => {
    setBusy("commit");
    setError(null);
    try {
      const next = await commitGitChanges(message);
      setSnapshot(next);
      const log = await fetchGitLog(10).catch(() => null);
      if (log) setCommits(log.commits);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return false;
    } finally {
      setBusy(null);
    }
  }, []);

  return { snapshot, commits, error, loading, busy, refresh, checkout, commit };
}
