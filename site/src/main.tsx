import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/inter/wght.css';
import '@fontsource/space-grotesk/latin-700.css';
import '@fontsource/ibm-plex-mono/latin-500.css';
import './index.css';
import { Header } from './components/Header';
import { Hero } from './components/Hero';
import { Features, HowItWorks, TrustStrip } from './components/Sections';
import { Guide } from './components/Guide';
import { Gallery } from './components/Gallery';
import { Download, Faq, Footer, Promo } from './components/Bottom';

// Scroll-in animations only run when JS is on.
document.documentElement.classList.add('js');

function App() {
  return (
    <>
      <Header />
      <main id="main">
        <Hero />
        <TrustStrip />
        <Features />
        <HowItWorks />
        <Guide />
        <Gallery />
        <Download />
        <Faq />
        <Promo />
      </main>
      <Footer />
    </>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
