export function HomeDisplayWordmark() {
  return (
    <div
      role="img"
      aria-label="Sber Designer"
      className="select-none text-center text-[clamp(2rem,7vw,3rem)] leading-none tracking-[0.025em] text-primary"
    >
      <span aria-hidden="true">
        <span className="sd-design-display-script">S</span>
        <span className="sd-design-display-pixel">BER </span>
        <span className="sd-design-display-script">D</span>
        <span className="sd-design-display-pixel">E</span>
        <span className="sd-design-display-script">S</span>
        <span className="sd-design-display-support">IG</span>
        <span className="sd-design-display-pixel">NER</span>
      </span>
    </div>
  );
}
