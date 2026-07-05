import { motion } from "framer-motion";
import { Star, Quote } from "lucide-react";

interface Testimonial {
  id: number;
  name: string;
  initials: string;
  quote: string;
  rating: number;
}

const testimonials: Testimonial[] = [
  {
    id: 1,
    name: "Priya Sharma",
    initials: "PS",
    quote:
      "The craftsmanship of the Titli bracelet is absolutely breathtaking. Every detail reflects the rich heritage of Indian jewellery artistry.",
    rating: 5,
  },
  {
    id: 2,
    name: "Aisha Patel",
    initials: "AP",
    quote:
      "I wore the Nakhrali earrings to my sister's wedding and received countless compliments. The gold work is exquisite and timeless.",
    rating: 5,
  },
  {
    id: 3,
    name: "Meera Kapoor",
    initials: "MK",
    quote:
      "Nakhrali's bridal collection exceeded all expectations. The set I chose became a family heirloom the moment I wore it.",
    rating: 5,
  },
  {
    id: 4,
    name: "Radhika Mehta",
    initials: "RM",
    quote:
      "The attention to detail in my pieces is remarkable. It's not just jewellery — it's wearable art that tells a story.",
    rating: 5,
  },
  {
    id: 5,
    name: "Kavya Reddy",
    initials: "KR",
    quote:
      "From browsing to delivery, the experience was exceptional. My bangles are stunning and truly one-of-a-kind pieces.",
    rating: 5,
  },
];

export function TestimonialsSection() {
  return (
    <section className="w-full py-20 px-4" style={{ background: "#0f0d09" }}>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-14"
        >
          {/* Ornament line */}
          <div className="flex items-center justify-center gap-3 mb-5">
            <div className="h-px w-12" style={{ background: "rgba(184,150,12,0.4)" }} />
            <span className="text-xs uppercase tracking-[0.2em]" style={{ color: "rgba(184,150,12,0.6)" }}>
              Stories
            </span>
            <div className="h-px w-12" style={{ background: "rgba(184,150,12,0.4)" }} />
          </div>
          <h2
            className="font-cormorant text-4xl md:text-5xl font-semibold mb-3"
            style={{ color: "#b8960c" }}
          >
            What Our Patrons Say
          </h2>
          <p className="text-sm max-w-md mx-auto" style={{ color: "rgba(250,248,242,0.45)" }}>
            Worn at weddings, celebrations, and quiet moments that last a lifetime.
          </p>
        </motion.div>

        {/* Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {testimonials.map((testimonial, index) => (
            <motion.div
              key={testimonial.id}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.08 }}
              whileHover={{ y: -6, transition: { duration: 0.25 } }}
              className="relative rounded-xl p-7 cursor-default"
              style={{
                background: "linear-gradient(135deg, #1a1714, #0f0d09)",
                border: "1px solid rgba(184,150,12,0.18)",
                boxShadow: "0 4px 24px rgba(0,0,0,0.4)",
                transition: "border-color 0.3s",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(184,150,12,0.38)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(184,150,12,0.18)";
              }}
            >
              {/* Quote icon badge */}
              <div className="absolute -top-4 left-7">
                <div
                  className="rounded-full p-2.5"
                  style={{ background: "#b8960c" }}
                >
                  <Quote className="w-4 h-4" style={{ color: "#0f0d09" }} />
                </div>
              </div>

              <div className="mt-4">
                {/* Stars */}
                <div className="flex gap-0.5 mb-4">
                  {Array.from({ length: testimonial.rating }).map((_, i) => (
                    <Star key={i} className="w-4 h-4" style={{ fill: "#b8960c", color: "#b8960c" }} />
                  ))}
                </div>

                {/* Quote text */}
                <p
                  className="text-sm leading-relaxed mb-6 min-h-[96px]"
                  style={{ color: "rgba(250,248,242,0.7)" }}
                >
                  "{testimonial.quote}"
                </p>

                {/* Author */}
                <div
                  className="flex items-center gap-3 pt-4"
                  style={{ borderTop: "1px solid rgba(184,150,12,0.18)" }}
                >
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                    style={{ background: "linear-gradient(135deg, #b8960c, #8a6e09)" }}
                  >
                    <span
                      className="font-cormorant font-semibold text-base"
                      style={{ color: "#0f0d09" }}
                    >
                      {testimonial.initials}
                    </span>
                  </div>
                  <div>
                    <p className="font-cormorant font-semibold text-base" style={{ color: "#b8960c" }}>
                      {testimonial.name}
                    </p>
                    <p className="text-xs" style={{ color: "rgba(250,248,242,0.35)" }}>
                      Valued Client
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
