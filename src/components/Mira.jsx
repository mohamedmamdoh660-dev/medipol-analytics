// Ms. Mira — the real rendered character. If an animated, transparent clip is
// present (public/mira.webm / .mp4) she plays it (natural motion + gestures,
// like a rendered character). Until then the still cutout (public/mira.png)
// shows as the video poster, with a gentle CSS idle so nothing looks frozen.
export default function Mira({ size = 'md', greet = false, greetText = 'Hi!' }) {
  const base = import.meta.env.BASE_URL // "/" in dev, "/analytics/" in build
  return (
    <span className={`mira3d mira3d-${size}`}>
      {greet && <span className="mira-bubble">{greetText} 👋</span>}
      <span className="mira-stage">
        <span className="mira-float">
          <video
            className="mira-media mira-video"
            poster={`${base}mira.png`}
            autoPlay
            loop
            muted
            playsInline
            preload="auto"
            aria-label="Ms. Mira"
          >
            <source src={`${base}mira.webm`} type="video/webm" />
            <source src={`${base}mira.mp4`} type="video/mp4" />
          </video>
        </span>
      </span>
    </span>
  )
}
