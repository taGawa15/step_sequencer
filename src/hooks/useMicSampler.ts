import { useCallback, useEffect, useRef, useState } from 'react';
import { STORAGE_KEY_SAMPLES } from '../constants';
import type { DrumTrackId } from '../types';
import type { SampleMetadata } from '../types/sample';
import { sampleDb } from '../storage/sampleDb';

type Permission = 'unknown' | 'granted' | 'denied' | 'unsupported';

interface PersistedSamples {
  samples: Omit<SampleMetadata, 'url'>[];
}

const loadMeta = (): Omit<SampleMetadata, 'url'>[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SAMPLES);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Partial<PersistedSamples>;
    return Array.isArray(parsed.samples) ? parsed.samples : [];
  } catch {
    return [];
  }
};

export const useMicSampler = () => {
  const [permission, setPermission] = useState<Permission>('unknown');
  const [recording, setRecording] = useState(false);
  const [maxRecordSec, setMaxRecordSec] = useState(10);
  const [samples, setSamples] = useState<SampleMetadata[]>([]);
  const [error, setError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(0);
  const stopTimerRef = useRef<number | null>(null);

  // ── Initial load: meta from localStorage, blobs from IndexedDB ────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const meta = loadMeta();
      const restored: SampleMetadata[] = [];
      for (const m of meta) {
        try {
          const blob = await sampleDb.get(m.id);
          if (blob) {
            restored.push({ ...m, url: URL.createObjectURL(blob) });
          }
        } catch {
          /* skip broken entry */
        }
      }
      if (!cancelled) setSamples(restored);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Persist metadata only (blobs live in IndexedDB)
  useEffect(() => {
    try {
      const meta = samples.map((s) => {
        const { url: _u, ...rest } = s;
        void _u;
        return rest;
      });
      localStorage.setItem(
        STORAGE_KEY_SAMPLES,
        JSON.stringify({ samples: meta }),
      );
    } catch {
      /* ignore quota */
    }
  }, [samples]);

  const startRecording = useCallback(async () => {
    setError(null);
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setPermission('unsupported');
      setError('このブラウザはマイク入力に対応していません');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setPermission('granted');
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || 'audio/webm',
        });
        chunksRef.current = [];
        // stop the underlying stream tracks
        stream.getTracks().forEach((t) => t.stop());
        const id = `s-${Date.now()}`;
        const durationSec = (performance.now() - startedAtRef.current) / 1000;
        try {
          await sampleDb.put(id, blob);
        } catch {
          setError('IndexedDB への保存に失敗しました');
          return;
        }
        const url = URL.createObjectURL(blob);
        setSamples((prev) => [
          ...prev,
          {
            id,
            name: `Sample ${prev.length + 1}`,
            createdAt: new Date().toISOString(),
            durationSec,
            url,
            assignedTo: null,
            gain: 0.8,
            pitch: 0,
            oneShot: true,
          },
        ]);
      };
      recorder.start();
      startedAtRef.current = performance.now();
      recorderRef.current = recorder;
      setRecording(true);

      // Auto-stop at maxRecordSec
      stopTimerRef.current = window.setTimeout(() => {
        if (recorderRef.current?.state === 'recording') {
          recorderRef.current.stop();
        }
      }, maxRecordSec * 1000);
    } catch (e) {
      setPermission('denied');
      setError(
        '録音を開始できませんでした。マイクの許可を確認してください。',
      );
    }
  }, [maxRecordSec]);

  const stopRecording = useCallback(() => {
    if (stopTimerRef.current !== null) {
      window.clearTimeout(stopTimerRef.current);
      stopTimerRef.current = null;
    }
    if (recorderRef.current?.state === 'recording') {
      recorderRef.current.stop();
    }
    recorderRef.current = null;
    setRecording(false);
  }, []);

  const toggleRecording = useCallback(() => {
    if (recording) stopRecording();
    else void startRecording();
  }, [recording, startRecording, stopRecording]);

  const renameSample = useCallback((id: string, name: string) => {
    setSamples((prev) => prev.map((s) => (s.id === id ? { ...s, name } : s)));
  }, []);

  const updateSample = useCallback(
    (id: string, patch: Partial<SampleMetadata>) => {
      setSamples((prev) =>
        prev.map((s) => (s.id === id ? { ...s, ...patch } : s)),
      );
    },
    [],
  );

  const deleteSample = useCallback(async (id: string) => {
    setSamples((prev) => {
      const target = prev.find((s) => s.id === id);
      if (target) URL.revokeObjectURL(target.url);
      return prev.filter((s) => s.id !== id);
    });
    try {
      await sampleDb.delete(id);
    } catch {
      /* ignore */
    }
  }, []);

  const assignToTrack = useCallback(
    (id: string, trackId: DrumTrackId | null) => {
      setSamples((prev) =>
        prev.map((s) => {
          if (s.id === id) return { ...s, assignedTo: trackId };
          // Only one sample assigned per track at a time
          if (trackId && s.assignedTo === trackId) return { ...s, assignedTo: null };
          return s;
        }),
      );
    },
    [],
  );

  return {
    permission,
    recording,
    maxRecordSec,
    setMaxRecordSec,
    samples,
    error,
    toggleRecording,
    startRecording,
    stopRecording,
    renameSample,
    updateSample,
    deleteSample,
    assignToTrack,
  };
};
