/**
 * HeroSection — Nakhrali
 * Clean white editorial hero. Cormorant Garamond serif.
 * Tagline: "Bold, Elegant, You."
 * Right column: 3 properly positioned floating cards (no CSS 3D, just 2D rotate + framer-motion y).
 */
import React, { useEffect, useRef } from 'react';
import { motion, useAnimation, useInView } from 'framer-motion';
import { ArrowRight } from 'lucide-react';

interface HeroSectionProps {
  isAuthenticated: boolean;
  onBrowse: () => void;
  onSignIn: () => void;
  productCount?: number;
  categoryCount?: number;
}

export function HeroSection({ isAuthenticated, onBrowse, onSignIn, productCount, categoryCount }: HeroSectionProps) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });
  const controls = useAnimation();

  useEffect(() => {
    if (isInView) controls.start('visible');
  }, [isInView, controls]);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.18, delayChildren: 0.2 } },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 24 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.65, ease: [0.22, 1, 0.36, 1] } },
  };

  return (
    <div
      ref={ref}
      className="relative overflow-hidden bg-background"
      style={{ minHeight: 'calc(100vh - 80px)' }}
    >
      {/* ── Subtle background ornament ── */}
      <div className="pointer-events-none absolute inset-0">
        {/* Radial gold wash top-right */}
        <div
          className="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full opacity-20"
          style={{ background: 'radial-gradient(circle, hsl(44 76% 60%) 0%, transparent 70%)' }}
        />
        {/* Diagonal fine lines pattern */}
        <div
          className="absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage: 'repeating-linear-gradient(45deg, hsl(44 76% 38%) 0px, hsl(44 76% 38%) 1px, transparent 0px, transparent 50%)',
            backgroundSize: '28px 28px',
          }}
        />
      </div>

      <div className="relative z-10 container mx-auto px-4 py-16 lg:py-24 flex items-center" style={{ minHeight: 'calc(100vh - 80px)' }}>
        <div className="grid lg:grid-cols-2 gap-16 lg:gap-24 items-center w-full">

          {/* ── Left: content ── */}
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate={controls}
            className="space-y-7"
          >
            {/* Badge */}
            <motion.div variants={itemVariants}>
              <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs uppercase tracking-[0.18em] font-medium border"
                style={{
                  color: 'hsl(var(--primary))',
                  borderColor: 'hsl(var(--primary) / 0.25)',
                  background: 'hsl(var(--primary) / 0.06)',
                }}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse inline-block" />
                Handcrafted Heritage Jewellery
              </span>
            </motion.div>

            {/* Ornament line + headline */}
            <motion.div variants={itemVariants} className="space-y-2">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-px w-12" style={{ background: 'linear-gradient(to right, hsl(var(--primary)), transparent)' }} />
                <span className="text-[10px] uppercase tracking-[0.24em]" style={{ color: 'hsl(var(--primary) / 0.6)' }}>
                  NAKHRALI
                </span>
              </div>
              <h1
                className="font-display leading-[1.05] tracking-tight"
                style={{ fontSize: 'clamp(3rem, 7vw, 5.5rem)', color: 'hsl(var(--foreground))' }}
              >
                Bold,<br />
                <span style={{ color: 'hsl(var(--primary))' }}>Elegant,</span><br />
                You.
              </h1>
            </motion.div>

            {/* Sub-copy */}
            <motion.p
              variants={itemVariants}
              className="text-base leading-relaxed max-w-md"
              style={{ color: 'hsl(var(--muted-foreground))' }}
            >
              Twenty-six handcrafted pieces — each named for a Sanskrit word,
              each set with heritage stones, polki diamonds and gold-plated settings.
              Bridal, festive, contemporary.
            </motion.p>

            {/* CTAs */}
            <motion.div variants={itemVariants} className="flex flex-wrap gap-3">
              <button
                onClick={onBrowse}
                className="group inline-flex items-center gap-2 h-11 px-7 rounded-full text-sm font-medium cursor-pointer transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5"
                style={{
                  background: 'linear-gradient(135deg, hsl(44 76% 32%), hsl(44 76% 46%))',
                  color: '#fff',
                  boxShadow: '0 4px 20px hsl(44 76% 38% / 0.25)',
                }}
              >
                Explore Collection
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-200" />
              </button>

              {!isAuthenticated && (
                <button
                  onClick={onSignIn}
                  className="inline-flex items-center gap-2 h-11 px-7 rounded-full text-sm font-medium cursor-pointer transition-all duration-200 hover:bg-muted"
                  style={{
                    border: '1.5px solid hsl(var(--border))',
                    color: 'hsl(var(--foreground))',
                    background: 'transparent',
                  }}
                >
                  Sign In to Order
                </button>
              )}
            </motion.div>

            {/* Stats */}
            <motion.div variants={itemVariants} className="flex items-center gap-8 pt-4">
              <div>
                <p className="font-display text-3xl font-semibold" style={{ color: 'hsl(var(--foreground))' }}>{productCount ?? '—'}</p>
                <p className="text-xs uppercase tracking-[0.14em] mt-0.5" style={{ color: 'hsl(var(--muted-foreground))' }}>Pieces</p>
              </div>
              <div className="w-px h-10" style={{ background: 'hsl(var(--border))' }} />
              <div>
                <p className="font-display text-3xl font-semibold" style={{ color: 'hsl(var(--foreground))' }}>{categoryCount ?? '—'}</p>
                <p className="text-xs uppercase tracking-[0.14em] mt-0.5" style={{ color: 'hsl(var(--muted-foreground))' }}>Collections</p>
              </div>
              <div className="w-px h-10" style={{ background: 'hsl(var(--border))' }} />
              <div>
                <p className="font-display text-3xl font-semibold" style={{ color: 'hsl(var(--foreground))' }}>100%</p>
                <p className="text-xs uppercase tracking-[0.14em] mt-0.5" style={{ color: 'hsl(var(--muted-foreground))' }}>Handcrafted</p>
              </div>
            </motion.div>
          </motion.div>

          {/* ── Right: floating showcase cards ── */}
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.9, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="relative hidden lg:flex flex-col gap-6 items-center"
          >
            {/* Row 1: Logo card (left) + Titli card (right) — side by side, no overlap */}
            <div className="flex gap-5 w-full justify-center">

              {/* Card 1 — Nakhrali logo */}
              <motion.div
                className="w-44 flex-shrink-0 -rotate-3"
                animate={{ y: [0, -12, 0] }}
                transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut', delay: 0 }}
              >
                <div className="rounded-2xl overflow-hidden" style={{
                  background: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  boxShadow: '0 8px 32px hsl(30 15% 9% / 0.12)',
                }}>
                  <div className="h-36 overflow-hidden bg-white flex items-center justify-center">
                    <img src="/nakhrali-logo.jpg" alt="Nakhrali" className="w-full h-full object-cover" />
                  </div>
                  <div className="p-3">
                    <p className="text-[9px] uppercase tracking-[0.18em]" style={{ color: 'hsl(var(--muted-foreground))' }}>Heritage Brand</p>
                    <p className="font-display text-base font-semibold mt-0.5" style={{ color: 'hsl(var(--foreground))' }}>Nakhrali</p>
                  </div>
                </div>
              </motion.div>

              {/* Card 2 — Titli (green bracelet) */}
              <motion.div
                className="w-44 flex-shrink-0 rotate-3"
                animate={{ y: [0, -12, 0] }}
                transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut', delay: 0.4 }}
              >
                <div className="rounded-2xl overflow-hidden" style={{
                  background: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  boxShadow: '0 8px 32px hsl(30 15% 9% / 0.12)',
                }}>
                  <div className="h-36 overflow-hidden">
                    <img src="/titli-green.png" alt="Titli" className="w-full h-full object-cover object-top" />
                  </div>
                  <div className="p-3">
                    <p className="text-[9px] uppercase tracking-[0.18em]" style={{ color: 'hsl(var(--muted-foreground))' }}>Bangle</p>
                    <p className="font-display text-base font-semibold mt-0.5" style={{ color: 'hsl(var(--foreground))' }}>Titli</p>
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Card 3 — Empty / decorative, centred below */}
            <motion.div
              className="w-44 flex-shrink-0"
              animate={{ y: [0, -12, 0] }}
              transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut', delay: 0.8 }}
            >
              <div className="rounded-2xl overflow-hidden" style={{
                background: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border) / 0.6)',
                boxShadow: '0 8px 32px hsl(30 15% 9% / 0.08)',
              }}>
                {/* Decorative mandala placeholder */}
                <div className="h-36 flex items-center justify-center relative overflow-hidden" style={{ background: 'hsl(var(--muted) / 0.5)' }}>
                  <div className="absolute inset-0 opacity-20" style={{ background: 'radial-gradient(ellipse at 50% 50%, hsl(44 76% 60%), transparent 70%)' }} />
                  <svg viewBox="0 0 80 80" className="w-16 h-16 opacity-30" style={{ color: 'hsl(44 76% 38%)' }}>
                    <circle cx="40" cy="40" r="35" fill="none" stroke="currentColor" strokeWidth="1" />
                    <circle cx="40" cy="40" r="25" fill="none" stroke="currentColor" strokeWidth="0.75" />
                    <circle cx="40" cy="40" r="15" fill="none" stroke="currentColor" strokeWidth="0.75" />
                    <circle cx="40" cy="40" r="4" fill="currentColor" />
                    {[0,45,90,135,180,225,270,315].map(a => (
                      <line key={a} x1="40" y1="40"
                        x2={40 + 33 * Math.cos(a * Math.PI / 180)}
                        y2={40 + 33 * Math.sin(a * Math.PI / 180)}
                        stroke="currentColor" strokeWidth="0.5" />
                    ))}
                  </svg>
                </div>
                <div className="p-3">
                  <p className="text-[9px] uppercase tracking-[0.18em]" style={{ color: 'hsl(var(--muted-foreground))' }}>Coming Soon</p>
                  <p className="font-display text-base font-semibold mt-0.5" style={{ color: 'hsl(var(--foreground) / 0.4)' }}>New Arrivals</p>
                </div>
              </div>
            </motion.div>

            {/* Decorative gold glow behind */}
            <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 w-64 h-32 rounded-full opacity-10 pointer-events-none blur-2xl"
              style={{ background: 'radial-gradient(circle, hsl(44 76% 50%), transparent 70%)' }} />
          </motion.div>

        </div>
      </div>
    </div>
  );
}
