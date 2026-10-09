/**
 * Real git state of the agent's workspace: branches, HEAD, dirty flag, recent
 * commits, checkout and commit — all through the bridge's `git` endpoints, so
 * every surface that shows branches agrees on one source of truth.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import {
  checkoutGitBranch,
  commitGitChanges,
  fetchGitDiff,
  fetchGitLog,
  fetchGitSnapshot,
  type GitCommitEntry,
  type GitDiffFile,
  type GitSnapshot,
} from "../omp/cli";

export interface GitRepoApi {
  snapshot: GitSnapshot | null;
  commits: GitCommitEntry[];
  /** Uncommitted working-tree files (patch text included), fetched on demand. */
  changes: GitDiffFile[];
  changesLoading: boolean;
  loadChanges: () => Promise<void>;
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
  const [changes, setChanges] = useState<GitDiffFile[]>([]);
  const [changesLoading, setChangesLoading] = useState(false);
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

  /** The diff endpoint carries every patch, so it is loaded when a git surface
      asks for it instead of riding the 20s branch poll. */
  const loadChanges = useCallback(async () => {
    setChangesLoading(true);
    try {
      const diff = await fetchGitDiff();
      if (mountedRef.current) setChanges(diff.files);
    } catch (err) {
      if (mountedRef.current) setError(err instanceof Error ? err.message : String(err));
    } finally {
      if (mountedRef.current) setChangesLoading(false);
    }
  }, []);

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

  return {
    snapshot,
    commits,
    changes,
    changesLoading,
    loadChanges,
    error,
    loading,
    busy,
    refresh,
    checkout,
    commit,
  };
}
