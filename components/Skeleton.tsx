export function Skeleton({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={`skeleton${className ? ` ${className}` : ""}`}
      style={{ backgroundColor: "var(--bg-alt)", borderRadius: "6px", ...style }}
    />
  );
}
