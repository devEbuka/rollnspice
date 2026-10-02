import Image from "next/image";

export default function Hero() {
  return <>
    <section id="about" className="hero">
      <div className="hero-copy">
        <p className="eyebrow">Lagos made. Flame grilled.</p>
        <h1>Big flavour.<br />No <span>shortcuts.</span></h1>
        <p className="hero-description">Hand-rolled shawarma. Charcoal-grilled meat.<br className="hidden sm:block" /> Made fresh, every time.</p>
        <a href="#menu" className="primary-button hero-cta">Explore the menu <span aria-hidden="true">↗</span></a>
      </div>
      <div className="hero-visual">
        <Image src="/images/hero-cutout.png" alt="Two freshly grilled beef shawarma halves in Roll N Spice wrapping" width={1536} height={1024} preload sizes="(max-width: 760px) 100vw, 55vw" />
        <span className="fresh-sticker" aria-hidden="true">Rolled<br />fresh<span>↗</span></span>
      </div>
    </section>
    <div className="brand-strip" aria-label="Flame grilled, hand rolled, Lagos loved">
      <span>Flame grilled</span><i aria-hidden="true">/</i><span>Hand rolled</span><i aria-hidden="true">/</i><span>Lagos loved</span>
    </div>
  </>;
}
