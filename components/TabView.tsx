"use client";

import { useEffect, useRef } from "react";

type AsciiProps = { kind: "ascii"; text: string };
type GpProps    = { kind: "guitar-pro"; src: string };
type Props = AsciiProps | GpProps;

export function TabView(props: Props) {
  if (props.kind === "ascii") {
    return <pre className="font-mono whitespace-pre overflow-x-auto p-4 bg-neutral-900 rounded">{props.text}</pre>;
  }
  return <AlphaTabView src={props.src} />;
}

function AlphaTabView({ src }: { src: string }) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    let api: unknown = null;
    let cancelled = false;
    (async () => {
      const { AlphaTabApi, Settings } = await import("@coderline/alphatab");
      if (cancelled || !mountRef.current) return;
      const settings = new Settings();
      settings.core.file = src;
      api = new AlphaTabApi(mountRef.current, settings);
    })();
    return () => {
      cancelled = true;
      if (api && typeof (api as { destroy?: () => void }).destroy === "function") {
        (api as { destroy: () => void }).destroy();
      }
    };
  }, [src]);
  return <div ref={mountRef} className="alphatab-container" />;
}
