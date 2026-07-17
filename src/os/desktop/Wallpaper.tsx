import "./wallpaper.css";

/**
 * Wallpaper procedural "amanhecer no Olimpo" — gradientes em camadas,
 * montanhas em SVG e estrelas. Zero assets externos, zero licença.
 */
function Wallpaper() {
  return (
    <div className="wallpaper" aria-hidden>
      <div className="wallpaper__sky" />
      <div className="wallpaper__stars" />
      <div className="wallpaper__glow" />
      <svg
        className="wallpaper__mountains"
        viewBox="0 0 1440 420"
        preserveAspectRatio="xMidYMax slice"
      >
        <path
          d="M0 420 L0 300 L180 190 L310 265 L470 120 L640 250 L790 170 L960 290 L1120 150 L1290 260 L1440 200 L1440 420 Z"
          fill="rgba(13, 18, 38, 0.85)"
        />
        <path
          d="M0 420 L0 350 L140 280 L300 340 L480 230 L660 330 L860 250 L1040 350 L1240 270 L1440 330 L1440 420 Z"
          fill="rgba(7, 10, 24, 0.95)"
        />
        <path
          d="M470 120 L505 155 L470 148 L448 162 Z"
          fill="rgba(232, 230, 240, 0.28)"
        />
        <path
          d="M1120 150 L1152 182 L1118 176 L1098 190 Z"
          fill="rgba(232, 230, 240, 0.22)"
        />
      </svg>
      <div className="wallpaper__vignette" />
    </div>
  );
}

export default Wallpaper;
