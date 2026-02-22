import { useState, useEffect } from "react";
import { AnimatePresence } from "framer-motion";
import Header from "@/components/Header";
import HeroCarousel from "@/components/HeroCarousel";
import AlbumsSection from "@/components/AlbumsSection";
import AboutSection from "@/components/AboutSection";
import ContactSection from "@/components/ContactSection";
import LoadingScreen from "@/components/LoadingScreen";
import { fetchSiteData, type SiteData } from "@/lib/api";

const FOLDER_URL = "https://drive.google.com/drive/folders/1uDfgMQAKuW2oeSgPBj19ZhpcqnIhoIs1?usp=sharing";

const Index = () => {
  const [loading, setLoading] = useState(true);
  const [siteData, setSiteData] = useState<SiteData | null>(null);

  useEffect(() => {
    fetchSiteData(FOLDER_URL)
      .then((data) => setSiteData(data))
      .catch((err) => console.error("Error fetching site data:", err))
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <AnimatePresence>
        {loading && <LoadingScreen onFinish={() => {}} />}
      </AnimatePresence>

      {!loading && siteData && (
        <main className="min-h-screen bg-background">
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
