"use client";

import { useState, useCallback } from "react";

export function useTranspose() {
  const [semitones, setSemitones] = useState(0);

  const up = useCallback(() => setSemitones(n => n + 1), []);
  const down = useCallback(() => setSemitones(n => n - 1), []);
  const reset = useCallback(() => setSemitones(0), []);

  return { semitones, up, down, reset };
}
