import { useState, useEffect, useRef } from "react";
import { AnimatePresence } from "framer-motion";
import Header from "@/components/Header";
import HeroCarousel from "@/components/HeroCarousel";
import AlbumsSection from "@/components/AlbumsSection";
import AboutSection from "@/components/AboutSection";
import ContactSection from "@/components/ContactSection";
import LoadingScreen from "@/components/LoadingScreen";
import { fetchSiteData, notifyAccess, type SiteData } from "@/lib/api";

const Index = () => {
  const [loading, setLoading] = useState(true);
  const [siteData, setSiteData] = useState<SiteData | null>(null);
  const didRunEntryEffects = useRef(false);

  useEffect(() => {
    fetchSiteData()
      .then((data) => setSiteData(data))
      .catch((err) => console.error("Error fetching site data:", err))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (didRunEntryEffects.current) return;
    didRunEntryEffects.current = true;

    notifyAccess(window.location.pathname)
      .catch((err) => console.error("Error notifying access:", err));
  }, []);

  return (
    <>
      <AnimatePresence>
        {loading && <LoadingScreen onFinish={() => {}} />}
      </AnimatePresence>

      {!loading && siteData && (
        <main className="min-h-screen bg-background w-full lg:max-w-[800px] lg:mx-auto">
          <Header />
          <HeroCarousel slides={siteData.homePhotos.map(p => p.src)} />
          <AlbumsSection albums={siteData.albums} />
          <AboutSection photoUrl={siteData.aboutPhotoUrl} />
          <ContactSection />

          <footer className="py-10 text-center text-xs text-muted-foreground/40 tracking-widest font-medium">
            © 2026 Mônica Lima Photography
          </footer>
        </main>
      )}
    </>
  );
};

export default Index;
