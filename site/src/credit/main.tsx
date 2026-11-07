import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/plus-jakarta-sans/wght.css';
import '@fontsource/newsreader/latin-400.css';
import '@fontsource/newsreader/latin-400-italic.css';
import '@fontsource/ibm-plex-mono/latin-500.css';
import './credit.css';
import { Hero } from './Hero';
import { CtaBand, Developers, Faq, Marquee, Models, Pricing, Steps, UseCases } from './Sections';
import { Footer, FreeApp, Nav } from './Shell';

document.documentElement.classList.add('js');

function BuyApiCredit() {
  return (
    <>
      <Nav />
      <main id="main">
        <Hero />
        <Marquee />
        <UseCases />
        <Models />
        <Pricing />
        <Steps />
        <Developers />
        <FreeApp />
        <Faq />
        <CtaBand />
      </main>
      <Footer />
    </>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BuyApiCredit />
  </StrictMode>,
);
