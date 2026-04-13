/**
 * Header — Nakhrali floating nav
 * Uses design system CSS vars (blue primary, dark background) — no inline gold overrides
 */
import { useState } from "react";
import { ShoppingCart, User, LogOut, UserCheck, Settings, Menu } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface HeaderProps {
  cartCount?: number;
  onCartClick?: () => void;
  onLoginClick?: () => void;
}

const navLinks = [
  { label: "Collection", href: "/#collection" },
  { label: "About", href: "#about" },
];

export const Header = ({ cartCount = 0, onCartClick, onLoginClick }: HeaderProps) => {
  const { isAuthenticated, profile, isAdmin, isSalesAdmin } = useAuth();
  const { toast } = useToast();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast({ title: "Error", description: "Failed to sign out", variant: "destructive" });
    } else {
      toast({ title: "Signed out", description: "See you soon." });
    }
    setMobileOpen(false);
  };

  const displayName = profile?.full_name || profile?.email?.split("@")[0] || "Account";
  const initials = displayName.slice(0, 2).toUpperCase();

  return (
    <header className="sticky top-4 z-50 flex justify-center px-4">
      <div className="w-full max-w-4xl flex items-center justify-between gap-4 h-14 px-5 rounded-2xl bg-card/80 backdrop-blur-xl border border-border/60 shadow-nav transition-all duration-300">

        {/* ── Logo ── */}
        <Link to="/" className="flex items-center gap-2.5 shrink-0 group cursor-pointer">
          <div className="h-8 w-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center transition-all duration-300 group-hover:bg-primary/20">
            <span className="text-xs font-bold text-primary">N</span>
          </div>
          <div className="hidden sm:block">
            <p className="text-sm font-semibold leading-none text-foreground tracking-tight">NAKHRALI</p>
            <p className="text-[10px] text-muted-foreground tracking-wide mt-0.5">Heritage Jewellery</p>
          </div>
        </Link>

        {/* ── Desktop nav ── */}
        <nav className="hidden md:flex items-center gap-1">
          {navLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="px-3 py-1.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors duration-150 cursor-pointer"
            >
              {link.label}
            </a>
          ))}
          {(isAdmin || isSalesAdmin) && (
            <Link to="/admin" className="px-3 py-1.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors duration-150 cursor-pointer">
              Admin
            </Link>
          )}
        </nav>

        {/* ── Actions ── */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onCartClick}
            className="relative h-9 px-3 rounded-full flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors duration-150 cursor-pointer"
          >
            <ShoppingCart className="h-4 w-4" />
            <span className="hidden sm:inline">Bag</span>
            {cartCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center bg-primary text-primary-foreground text-[10px] font-bold rounded-full px-1 shadow-sm">
                {cartCount > 99 ? "99+" : cartCount}
              </span>
            )}
          </button>

          <div className="hidden md:flex">
            {isAuthenticated && profile ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="h-9 pl-1.5 pr-3 rounded-full flex items-center gap-2 hover:bg-muted/60 transition-colors duration-150 cursor-pointer">
                    <div className="h-6 w-6 rounded-full bg-primary flex items-center justify-center text-[10px] font-bold text-primary-foreground shrink-0">
                      {initials}
                    </div>
                    <span className="text-sm font-medium max-w-[100px] truncate text-foreground">{displayName}</span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52 rounded-xl p-1.5 shadow-lg mt-2">
                  <div className="px-2.5 py-2 mb-1">
                    <p className="text-xs font-semibold text-foreground truncate">{displayName}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{profile.email}</p>
                  </div>
                  <DropdownMenuSeparator />
                  {(isAdmin || isSalesAdmin) && (
                    <DropdownMenuItem asChild className="rounded-lg cursor-pointer">
                      <Link to="/admin" className="flex items-center gap-2.5 text-sm py-1.5">
                        <Settings className="h-4 w-4 text-muted-foreground" />Admin Dashboard
                      </Link>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem asChild className="rounded-lg cursor-pointer">
                    <Link to="/profile" className="flex items-center gap-2.5 text-sm py-1.5">
                      <UserCheck className="h-4 w-4 text-muted-foreground" />My Profile
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut} className="rounded-lg cursor-pointer text-sm py-1.5 text-destructive focus:text-destructive gap-2.5">
                    <LogOut className="h-4 w-4" />Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button size="sm" onClick={onLoginClick} className="h-8 px-4 rounded-full text-sm font-semibold cursor-pointer">
                <User className="h-3.5 w-3.5 mr-1.5" />Sign In
              </Button>
            )}
          </div>

          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <button className="md:hidden h-9 w-9 rounded-xl flex items-center justify-center hover:bg-muted/60 transition-colors duration-150 cursor-pointer text-muted-foreground hover:text-foreground">
                <Menu className="h-4.5 w-4.5" />
              </button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72 p-0">
              <SheetHeader className="p-5 pb-4 border-b border-border/60">
                <SheetTitle className="text-sm font-semibold text-foreground">NAKHRALI</SheetTitle>
              </SheetHeader>
              <div className="p-4 flex flex-col gap-1">
                {navLinks.map((link) => (
                  <a key={link.label} href={link.href} onClick={() => setMobileOpen(false)} className="px-3 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors duration-150 cursor-pointer">
                    {link.label}
                  </a>
                ))}
                <div className="border-t border-border/60 mt-3 pt-3">
                  {isAuthenticated && profile ? (
                    <div className="flex flex-col gap-1">
                      <div className="px-3 py-2 flex items-center gap-3 rounded-xl bg-muted/40">
                        <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-xs font-bold text-primary-foreground shrink-0">{initials}</div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">{displayName}</p>
                          <p className="text-[11px] text-muted-foreground truncate">{profile.email}</p>
                        </div>
                      </div>
                      <button onClick={handleSignOut} className="px-3 py-2.5 rounded-xl text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors duration-150 cursor-pointer flex items-center gap-2.5 w-full text-left">
                        <LogOut className="h-4 w-4" />Sign Out
                      </button>
                    </div>
                  ) : (
                    <Button onClick={() => { setMobileOpen(false); onLoginClick?.(); }} className="w-full h-10 rounded-xl cursor-pointer">
                      <User className="h-4 w-4 mr-2" />Sign In
                    </Button>
                  )}
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
};
