import Hero from "@/app/_components/sections/Hero";
import Install from "@/app/_components/sections/Install";
import Features from "@/app/_components/sections/Features";
import HowItWorks from "@/app/_components/sections/HowItWorks";
import Showcase from "@/app/_components/sections/Showcase";
import Pricing from "@/app/_components/sections/Pricing";
import Testimonials from "@/app/_components/sections/Testimonials";
import FAQ from "@/app/_components/sections/FAQ";
import FinalCTA from "@/app/_components/sections/FinalCTA";

export default function LandingPage() {
  return (
    <>
      <Hero />
      <Install />
      <Features />
      <HowItWorks />
      <Showcase />
      <Pricing />
      <Testimonials />
      <FAQ />
      <FinalCTA />
    </>
  );
}
