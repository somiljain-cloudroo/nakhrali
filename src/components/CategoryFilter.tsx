import { cn } from "@/lib/utils";

interface CategoryFilterProps {
  categories: string[];
  selectedCategory: string;
  onCategoryChange: (category: string) => void;
}

export const CategoryFilter = ({
  categories,
  selectedCategory,
  onCategoryChange,
}: CategoryFilterProps) => {
  const all = ["all", ...categories];

  return (
    <div className="relative">
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none [-ms-overflow-style:none] [scrollbar-width:none]">
        {all.map((cat) => {
          const isActive = selectedCategory === cat;
          return (
            <button
              key={cat}
              onClick={() => onCategoryChange(cat)}
              className={cn(
                "shrink-0 inline-flex items-center h-8 px-4 rounded-full text-sm font-medium transition-all duration-200 cursor-pointer whitespace-nowrap select-none",
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted/70 text-muted-foreground hover:bg-muted hover:text-foreground border border-border/40"
              )}
            >
              {cat === "all" ? "All Pieces" : cat}
            </button>
          );
        })}
      </div>
      <div className="pointer-events-none absolute right-0 top-0 h-full w-12 bg-gradient-to-l from-background to-transparent" />
    </div>
  );
};
