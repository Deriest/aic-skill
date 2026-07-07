export function StreamingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="bg-aic-bg-panel-dark border-2 border-aic-border px-3 py-2 font-pixel text-px-sm text-aic-yellow animate-blink-pixel">
        ◉ Processing...
      </div>
    </div>
  );
}
