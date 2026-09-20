'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';

/**
 * Voice-to-text via the browser's built-in speech recognition.
 *
 * Supported in Safari on iOS and Chrome on Android, which covers the phones
 * a tech will actually carry. Where it is missing the button hides itself
 * and the tech types instead — on-device dictation (the keyboard mic) still
 * works regardless.
 */

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getRecognition(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

// Capability detection is a read of an external system that never changes
// during the session, so there is nothing to subscribe to.
const noopSubscribe = () => () => {};
const getSupportedSnapshot = () => getRecognition() !== null;
const getSupportedServerSnapshot = () => false;

export default function VoiceNoteButton({ onText }: { onText: (text: string) => void }) {
  const supported = useSyncExternalStore(
    noopSubscribe,
    getSupportedSnapshot,
    getSupportedServerSnapshot,
  );
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => () => recognitionRef.current?.stop(), []);

  if (!supported) return null;

  function toggle() {
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }

    const Ctor = getRecognition();
    if (!Ctor) return;

    const recognition = new Ctor();
    recognition.lang = 'en-US';
    recognition.continuous = true;
    recognition.interimResults = false;

    recognition.onresult = (event) => {
      let text = '';
      for (let i = 0; i < event.results.length; i += 1) {
        text += event.results[i][0].transcript;
      }
      onText(text.trim());
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);

    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={listening}
      className={`inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-xs font-semibold ${
        listening ? 'bg-red-700 text-white' : 'bg-navy-700 text-white'
      }`}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
           className="h-4 w-4" strokeLinecap="round" strokeLinejoin="round">
        <rect x="9" y="2" width="6" height="12" rx="3" />
        <path d="M5 11a7 7 0 0 0 14 0" />
        <path d="M12 18v4" />
      </svg>
      {listening ? 'Listening… tap to stop' : 'Speak'}
    </button>
  );
}
