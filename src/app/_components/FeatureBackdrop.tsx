import Grainient from "./Grainient";

const VARIANTS = [
  { blendAngle: -25, colorBalance: 0.0, zoom: 0.4 },
  { blendAngle: 35, colorBalance: -0.05, zoom: 0.5 },
  { blendAngle: -55, colorBalance: 0.08, zoom: 0.35 },
  { blendAngle: 70, colorBalance: -0.02, zoom: 0.45 },
];

export default function FeatureBackdrop({ variant }: { variant: number }) {
  const v = VARIANTS[variant % VARIANTS.length];
  return (
    <div
      aria-hidden
      className="absolute inset-0 overflow-hidden opacity-0 transition-opacity duration-500 ease-out group-hover:opacity-100"
    >
      <div className="absolute inset-0">
        <Grainient
          color1="#E4E4E4"
          color2="#2B4559"
          color3="#E4E4E4"
          timeSpeed={1.2}
          colorBalance={v.colorBalance}
          warpStrength={0.4}
          warpFrequency={7.9}
          warpSpeed={0.4}
          warpAmplitude={13}
          blendAngle={v.blendAngle}
          blendSoftness={0.55}
          rotationAmount={500.0}
          noiseScale={2.0}
          grainAmount={0.1}
          grainScale={2.0}
          grainAnimated={false}
          contrast={1.5}
          gamma={1.0}
          saturation={1.0}
          centerX={0.0}
          centerY={0.0}
          zoom={v.zoom}
        />
      </div>
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(255,255,255,0.55)_0%,_rgba(255,255,255,0.2)_55%,_transparent_85%)]" />
    </div>
  );
}
