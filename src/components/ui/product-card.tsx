/**
 * product-card.tsx — adapted from 21st.dev
 * Changes from original:
 *  - Removed "use client" (Vite, not Next.js)
 *  - Replaced next/image <Image fill> with plain <img> (absolute inset-0)
 *  - Import from framer-motion instead of motion/react (same package v12)
 */
import * as React from "react"
import { AnimatePresence, motion } from "framer-motion"
import { cn } from "@/lib/utils"

export interface ProductImagesProps {
  id: string
  color: string
  images: string[]
}

interface ProductCardImagesProps {
  productImages: ProductImagesProps[]
  activeColor: number
  activeImage: number
  handleMouse: (event: "enter" | "leave") => void
  className?: string
}

const variants = { hidden: { opacity: 0 }, visible: { opacity: 1 } }

export function useSetActiveProduct(initialColor = 0) {
  const [state, setState] = React.useState({
    activeColor: initialColor,
    activeImage: 0,
  })

  const handleColorChange = React.useCallback((index: number) => {
    setState((prev) => ({ ...prev, activeColor: index }))
  }, [])

  const handleMouse = React.useCallback((event: "enter" | "leave") => {
    setState((prev) => ({
      ...prev,
      activeImage: event === "enter" ? 1 : 0,
    }))
  }, [])

  return { ...state, handleColorChange, handleMouse }
}

export function ProductCardImages({
  productImages,
  activeColor,
  activeImage,
  handleMouse,
  className,
}: ProductCardImagesProps) {
  const handleMouseEnter = () => handleMouse("enter")
  const handleMouseLeave = () => handleMouse("leave")

  return (
    <div className={cn("relative aspect-[4/3] overflow-hidden rounded-xl bg-muted/30", className)}>
      {productImages.map((productImage, index) => (
        <motion.div
          key={productImage.id}
          variants={variants}
          animate={index === activeColor ? "visible" : "hidden"}
          className="absolute inset-0 cursor-pointer overflow-hidden"
          exit="hidden"
        >
          <div
            className="relative h-full w-full"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          >
            {/* Primary image */}
            <img
              alt={`${productImage.color} — view 1`}
              src={productImage.images[0]}
              className="absolute inset-0 h-full w-full object-cover"
            />

            {/* Hover image (second image if provided) */}
            {productImage.images[1] && productImage.images[1] !== productImage.images[0] && (
              <AnimatePresence>
                <motion.img
                  key="hover-img"
                  alt={`${productImage.color} — view 2`}
                  src={productImage.images[1]}
                  loading="lazy"
                  variants={variants}
                  animate={
                    activeImage === 1 &&
                    productImage.id === productImages[activeColor].id
                      ? "visible"
                      : "hidden"
                  }
                  exit="hidden"
                  className="pointer-events-none absolute inset-0 h-full w-full object-cover"
                />
              </AnimatePresence>
            )}
          </div>
        </motion.div>
      ))}
    </div>
  )
}

const springTransition = {
  type: "spring",
  stiffness: 500,
  damping: 50,
  mass: 1,
}

interface ProductColorsThumbsProps {
  productId: string
  productColors: string[]        // CSS color values e.g. "#C9A84C"
  colorLabels?: string[]         // Human-readable labels e.g. "Gold"
  activeColor: number
  setActiveColor: (index: number) => void
  className?: string
}

export function ProductColorsThumbs({
  productId,
  productColors,
  colorLabels,
  activeColor,
  setActiveColor,
  className,
}: ProductColorsThumbsProps) {
  return (
    <div className={cn("my-2 flex gap-2 px-1", className)}>
      {productColors.map((productColor, index) => (
        <button
          key={productColor}
          role="button"
          aria-label={colorLabels?.[index] ?? `Color ${index + 1}`}
          title={colorLabels?.[index] ?? productColor}
          className="relative size-4 appearance-none rounded-full border border-neutral-200 cursor-pointer"
          style={{ background: productColor }}
          onMouseEnter={() => setActiveColor(index)}
          onClick={() => setActiveColor(index)}
        >
          {index === activeColor && (
            <motion.div
              layoutId={productId}
              className="absolute -left-[2px] -top-[2px] size-[18px] rounded-full border border-gray-500"
              transition={springTransition}
            />
          )}
        </button>
      ))}
    </div>
  )
}

interface ProductCardProps {
  id: string
  images: ProductImagesProps[]
  colors: string[]
  colorLabels?: string[]
  className?: string
}

export function ProductCard({ id, images, colors, colorLabels, className }: ProductCardProps) {
  const { activeColor, activeImage, handleColorChange, handleMouse } = useSetActiveProduct()

  return (
    <div id={id} className={cn("relative px-4 py-6", className)}>
      <ProductCardImages
        productImages={images}
        activeColor={activeColor}
        activeImage={activeImage}
        handleMouse={handleMouse}
      />
      <ProductColorsThumbs
        productId={id}
        productColors={colors}
        colorLabels={colorLabels}
        activeColor={activeColor}
        setActiveColor={handleColorChange}
      />
    </div>
  )
}
