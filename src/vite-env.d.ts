/// <reference types="vite/client" />

/** Injected by vite.config.ts `define`. */
declare const __APP_VERSION__: string;
declare const __APP_BUILD_DATE__: string;
/** sha1 prefix of `server.ts` at SPA build time; the bridge reports its own. */
declare const __SERVER_CODE_ID__: string;

/** Minimal Web Speech dictation typings (not in the DOM lib). */
interface OmpSpeechResult {
  readonly isFinal: boolean;
  readonly length: number;
  readonly 0: { transcript: string; confidence: number };
}

interface OmpSpeechRecognitionEvent {
  readonly resultIndex: number;
  readonly results: { readonly length: number; readonly [index: number]: OmpSpeechResult };
}

interface OmpSpeechRecognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: OmpSpeechRecognitionEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
}

type OmpSpeechRecognitionCtor = new () => OmpSpeechRecognition;

interface Window {
  SpeechRecognition?: OmpSpeechRecognitionCtor;
  webkitSpeechRecognition?: OmpSpeechRecognitionCtor;
}
