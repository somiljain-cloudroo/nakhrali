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
      "I loved the jewellery ordered from Nakhrali. Every detail reflects the rich heritage of Indian jewellery artistry. Would definitely recommend to my known ones.",
    rating: 5,
  },
  {
    id: 2,
    name: "Dhriti Dutta",
    initials: "DD",
    quote:
      "Loved the beautiful collection from Nakhrali. The jewellery is stylish, elegant and perfect for special occasions. Very happy with my purchase and have been recommending it to my friends.",
    rating: 5,
  },
  {
    id: 3,
    name: "Priyanka Dua",
    initials: "PD",
    quote:
      "I visited Nakhrali today, the jewellery designs are elegant and at the same time it gives you a classy look. All the pieces are beautiful and at an affordable price. My experience was amazing and would be visiting soon to buy some more.",
    rating: 5,
  },
  {
    id: 4,
    name: "Kirthi",
    initials: "K",
    quote:
      "Loved buying from Nakhrali. Very elegant pieces and budget friendly. Would highly recommend.",
    rating: 5,
  },
  {
    id: 5,
    name: "Fariba F",
    initials: "FF",
    quote:
      "I ordered from Nakhrali, the experience from start to finish was exceptional. The piece I received was exactly as described and matches perfectly with my outfit. Highly recommend!",
    rating: 5,
  },
  {
    id: 6,
    name: "Kavya",
    initials: "KV",
    quote:
      "Shoutout to Shivani at Nakhrali for saving the day! I desperately needed a pair of earrings last minute. Reached out to her & she was available in the odd hours. The Kashmiri earrings I got are gorgeous, but her amazing customer service was the real highlight. Thank you for making everything so easy!",
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
