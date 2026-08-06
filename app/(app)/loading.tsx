export default function Loading() {
  return (
    <div className="stack" style={{ gap: 18 }} aria-busy="true" aria-label="Loading">
      <div className="grid g-4" style={{ gap: 18 }}>
        <div className="skl" style={{ height: 104 }} />
        <div className="skl" style={{ height: 104 }} />
        <div className="skl" style={{ height: 104 }} />
        <div className="skl" style={{ height: 104 }} />
      </div>
      <div className="grid g-2-1" style={{ gap: 18 }}>
        <div className="skl" style={{ height: 300 }} />
        <div className="skl" style={{ height: 300 }} />
      </div>
    </div>
  );
}
