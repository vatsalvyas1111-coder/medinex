export const Skeleton = ({ className = '', style }: { className?: string; style?: React.CSSProperties }) => <div className={`skeleton ${className}`} style={style} aria-hidden="true" />;

export function PageSkeleton({ rows = 3, ring = false }: { rows?: number; ring?: boolean }) {
  return (
    <div className="space-y-5" role="status" aria-label="Loading">
      <Skeleton className="h-10 w-64" />
      {ring && <Skeleton className="h-56 w-full" />}
      {Array.from({ length: rows }).map((_, i) => <Skeleton key={i} className="h-28 w-full" />)}
    </div>
  );
}
