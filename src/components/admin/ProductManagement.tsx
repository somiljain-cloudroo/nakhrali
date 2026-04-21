import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit, Trash2, RefreshCw, Upload, ImagePlus, X, Check, Palette } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import Papa from "papaparse";

// ── Color options for Indian jewellery ──────────────────────────────────────
interface ColorOption {
  value: string;
  swatch: string; // CSS color or gradient
}

const JEWELLERY_COLORS: ColorOption[] = [
  { value: "Pink",       swatch: "#F4A7B9" },
  { value: "Teal",       swatch: "#008080" },
  { value: "Purple",     swatch: "#7B4F9E" },
  { value: "Green",      swatch: "#3A7D44" },
  { value: "White",      swatch: "#F5F5F5" },
  { value: "Beige",      swatch: "#D9C4A0" },
  { value: "Multi",      swatch: "linear-gradient(135deg, #F4A7B9 20%, #7B4F9E 20% 40%, #3A7D44 40% 60%, #D4AF37 60% 80%, #1B6CA8 80%)" },
  { value: "Golden",     swatch: "#C9A84C" },
  { value: "Blue",       swatch: "#1B6CA8" },
  { value: "Maroon",     swatch: "#800020" },
  { value: "Yellow",     swatch: "#F2C94C" },
  { value: "Brown",      swatch: "#7B4F2E" },
  { value: "Orange",     swatch: "#E07B39" },
  { value: "Silver",     swatch: "#A8A9AD" },
];

interface ColorImage {
  color: string;
  image_url: string;
}

interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  sku: string | null;
  brand: string | null;
  category_id: string | null;
  stock_quantity: number;
  min_order_quantity: number;
  unit: string;
  is_active: boolean;
  image_url: string | null;
  color_images: ColorImage[];
  categories?: { name: string } | null;
}

interface Category {
  id: string;
  name: string;
}

interface FormData {
  name: string;
  description: string;
  price: string;
  sku: string;
  brand: string;
  category_id: string;
  stock_quantity: string;
  min_order_quantity: string;
  unit: string;
  image_url: string;
  color_images: ColorImage[];
  is_active: boolean;
}

export const ProductManagement = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isBulkUploadOpen, setIsBulkUploadOpen] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadingColorIndex, setUploadingColorIndex] = useState<number | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const { toast } = useToast();

  const emptyForm = (): FormData => ({
    name: "",
    description: "",
    price: "",
    sku: "",
    brand: "",
    category_id: "",
    stock_quantity: "",
    min_order_quantity: "1",
    unit: "each",
    image_url: "",
    color_images: [],
    is_active: true,
  });

  const [formData, setFormData] = useState<FormData>(emptyForm());

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [productsRes, categoriesRes] = await Promise.all([
        supabase
          .from("products")
          .select("*, categories (name)")
          .order("created_at", { ascending: false }),
        supabase.from("categories").select("id, name").eq("is_active", true),
      ]);
      if (productsRes.error) throw productsRes.error;
      if (categoriesRes.error) throw categoriesRes.error;

      // Normalise color_images from JSON to typed array
      const normalised = (productsRes.data || []).map((p) => ({
        ...p,
        color_images: Array.isArray(p.color_images) ? (p.color_images as unknown as ColorImage[]) : [],
      }));

      setProducts(normalised);
      setCategories(categoriesRes.data || []);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast({ title: "Error", description: "Failed to load products", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData(emptyForm());
    setEditingProduct(null);
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      description: product.description || "",
      price: product.price.toString(),
      sku: product.sku || "",
      brand: product.brand || "",
      category_id: product.category_id || "",
      stock_quantity: product.stock_quantity.toString(),
      min_order_quantity: product.min_order_quantity.toString(),
      unit: product.unit,
      image_url: product.image_url || "",
      color_images: product.color_images || [],
      is_active: product.is_active,
    });
    setIsDialogOpen(true);
  };

  // ── Color helpers ──────────────────────────────────────────────────────────
  const toggleColor = (color: string) => {
    setFormData((prev) => {
      const exists = prev.color_images.find((ci) => ci.color === color);
      if (exists) {
        // Remove this color (and its image)
        return { ...prev, color_images: prev.color_images.filter((ci) => ci.color !== color) };
      }
      // Add with empty image_url
      return { ...prev, color_images: [...prev.color_images, { color, image_url: "" }] };
    });
  };

  const isColorSelected = (color: string) =>
    formData.color_images.some((ci) => ci.color === color);

  const handleColorImageUpload = async (file: File, colorIndex: number) => {
    setUploadingColorIndex(colorIndex);
    try {
      const ext = file.name.split(".").pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from("products").upload(fileName, file, { upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from("products").getPublicUrl(fileName);
      setFormData((prev) => {
        const updated = [...prev.color_images];
        updated[colorIndex] = { ...updated[colorIndex], image_url: data.publicUrl };
        // Sync image_url to first color's image for backward compat
        const newImageUrl = updated[0]?.image_url || prev.image_url;
        return { ...prev, color_images: updated, image_url: newImageUrl };
      });
      toast({ title: "Image uploaded" });
    } catch (error) {
      toast({ title: "Upload failed", description: (error as Error).message, variant: "destructive" });
    } finally {
      setUploadingColorIndex(null);
    }
  };

  const removeColorImage = (colorIndex: number) => {
    setFormData((prev) => {
      const updated = [...prev.color_images];
      updated[colorIndex] = { ...updated[colorIndex], image_url: "" };
      return { ...prev, color_images: updated };
    });
  };

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Use first color image as primary image_url if available
      const primaryImage =
        formData.color_images.find((ci) => ci.image_url)?.image_url ||
        formData.image_url ||
        null;

      const productData = {
        name: formData.name,
        description: formData.description || null,
        price: parseFloat(formData.price),
        sku: formData.sku || null,
        brand: formData.brand || null,
        category_id: formData.category_id || null,
        stock_quantity: parseInt(formData.stock_quantity),
        min_order_quantity: parseInt(formData.min_order_quantity),
        unit: formData.unit,
        image_url: primaryImage,
        color_images: formData.color_images as unknown as typeof import("@/integrations/supabase/types").Json,
        is_active: formData.is_active,
      };

      let error: Error | null = null;
      if (editingProduct) {
        const { data: rows, error: updateError } = await supabase
          .from("products")
          .update(productData)
          .eq("id", editingProduct.id)
          .select("id");
        error = updateError;
        if (!updateError && (!rows || rows.length === 0)) {
          error = new Error("Update blocked — check your admin permissions");
        }
      } else {
        const { error: insertError } = await supabase.from("products").insert(productData);
        error = insertError;
      }

      if (error) throw error;

      toast({ title: "Success", description: `Product ${editingProduct ? "updated" : "created"} successfully` });
      setIsDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error) {
      console.error("Error saving product:", error);
      toast({ title: "Error", description: `Failed to ${editingProduct ? "update" : "create"} product`, variant: "destructive" });
    }
  };

  const handleDelete = async (productId: string) => {
    if (!confirm("Are you sure you want to deactivate this product?")) return;
    try {
      const { error } = await supabase.from("products").update({ is_active: false }).eq("id", productId);
      if (error) throw error;
      toast({ title: "Success", description: "Product deactivated" });
      fetchData();
    } catch (error) {
      toast({ title: "Error", description: "Failed to deactivate product", variant: "destructive" });
    }
  };

  // ── Bulk upload ────────────────────────────────────────────────────────────
  const handleBulkUpload = async () => {
    if (!csvFile) {
      toast({ title: "No file selected", description: "Please select a CSV file.", variant: "destructive" });
      return;
    }
    setIsUploading(true);
    Papa.parse(csvFile, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const productsToInsert = results.data
          .map((row: any) => ({
            name: row.name,
            description: row.description || null,
            price: parseFloat(row.price),
            sku: row.sku || null,
            brand: row.brand || null,
            category_id: categories.find((c) => c.name === row.category)?.id || null,
            stock_quantity: parseInt(row.stock_quantity),
            min_order_quantity: parseInt(row.min_order_quantity) || 1,
            unit: row.unit || "each",
            image_url: row.image_url || null,
            color_images: [],
          }))
          .filter((p) => p.name && p.price && p.stock_quantity);

        if (productsToInsert.length === 0) {
          toast({ title: "No valid products found", variant: "destructive" });
          setIsUploading(false);
          return;
        }
        try {
          const { error } = await supabase.functions.invoke("bulk-create-products", {
            body: { products: productsToInsert },
          });
          if (error) throw error;
          toast({ title: "Success", description: `${productsToInsert.length} products uploaded.` });
          setIsBulkUploadOpen(false);
          setCsvFile(null);
          fetchData();
        } catch (error) {
          toast({ title: "Error", description: "Failed to upload products.", variant: "destructive" });
        } finally {
          setIsUploading(false);
        }
      },
      error: () => {
        toast({ title: "Error", description: "Failed to parse CSV file.", variant: "destructive" });
        setIsUploading(false);
      },
    });
  };

  // ── Loading skeleton ───────────────────────────────────────────────────────
  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="h-4 bg-muted rounded w-full mb-2" />
                <div className="h-4 bg-muted rounded w-3/4" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Product Management</h2>
          <p className="text-muted-foreground">Manage your product catalogue</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={fetchData} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={() => setIsBulkUploadOpen(true)} variant="outline">
            <Upload className="h-4 w-4 mr-2" />
            Bulk Upload
          </Button>

          {/* ── Add / Edit dialog ── */}
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => { resetForm(); setIsDialogOpen(true); }}>
                <Plus className="h-4 w-4 mr-2" />
                Add Product
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingProduct ? "Edit Product" : "Add New Product"}</DialogTitle>
                <DialogDescription>Fill in the product details below</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Name + SKU */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="name">Product Name *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="sku">SKU</Label>
                    <Input
                      id="sku"
                      value={formData.sku}
                      onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                    />
                  </div>
                </div>

                {/* Description */}
                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>

                {/* Brand + Category */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="brand">Brand</Label>
                    <Input
                      id="brand"
                      value={formData.brand}
                      onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="category">Category</Label>
                    <Select
                      value={formData.category_id}
                      onValueChange={(value) => setFormData({ ...formData, category_id: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((cat) => (
                          <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Price + Stock + Min order */}
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="price">Price *</Label>
                    <Input
                      id="price"
                      type="number"
                      step="0.01"
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="stock">Stock *</Label>
                    <Input
                      id="stock"
                      type="number"
                      value={formData.stock_quantity}
                      onChange={(e) => setFormData({ ...formData, stock_quantity: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="min_order">Min Order *</Label>
                    <Input
                      id="min_order"
                      type="number"
                      value={formData.min_order_quantity}
                      onChange={(e) => setFormData({ ...formData, min_order_quantity: e.target.value })}
                      required
                    />
                  </div>
                </div>

                {/* Unit */}
                <div>
                  <Label htmlFor="unit">Unit</Label>
                  <Select
                    value={formData.unit}
                    onValueChange={(value) => setFormData({ ...formData, unit: value })}
                  >
                    <SelectTrigger className="w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="piece">Piece</SelectItem>
                      <SelectItem value="set">Set</SelectItem>
                      <SelectItem value="each">Each</SelectItem>
                      <SelectItem value="pair">Pair</SelectItem>
                      <SelectItem value="kg">Kilogram</SelectItem>
                      <SelectItem value="case">Case</SelectItem>
                      <SelectItem value="box">Box</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Active toggle */}
                <div className="flex items-center justify-between rounded-lg border border-border p-3">
                  <div>
                    <Label htmlFor="is_active" className="text-sm font-medium">Active</Label>
                    <p className="text-xs text-muted-foreground">
                      When off, this product is hidden from the storefront and Meta catalogue.
                    </p>
                  </div>
                  <Switch
                    id="is_active"
                    checked={formData.is_active}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                  />
                </div>

                {/* ── Color & Images section ─────────────────────────────── */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Palette className="h-4 w-4 text-muted-foreground" />
                    <Label>Colours & Photos</Label>
                    <span className="text-xs text-muted-foreground">
                      — select colours, then upload one photo per colour
                    </span>
                  </div>

                  {/* Color chip grid */}
                  <div className="flex flex-wrap gap-2">
                    {JEWELLERY_COLORS.map((col) => {
                      const selected = isColorSelected(col.value);
                      return (
                        <button
                          key={col.value}
                          type="button"
                          onClick={() => toggleColor(col.value)}
                          className={`
                            flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium
                            transition-all duration-150 cursor-pointer
                            ${selected
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border bg-background text-muted-foreground hover:border-primary/50"}
                          `}
                        >
                          <span
                            className="h-3.5 w-3.5 rounded-full border border-black/10 flex-shrink-0"
                            style={{ background: col.swatch }}
                          />
                          {col.value}
                          {selected && <Check className="h-3 w-3 ml-0.5" />}
                        </button>
                      );
                    })}
                  </div>

                  {/* Per-colour upload slots */}
                  {formData.color_images.length > 0 && (
                    <div className="grid grid-cols-2 gap-3 pt-1">
                      {formData.color_images.map((ci, idx) => {
                        const col = JEWELLERY_COLORS.find((c) => c.value === ci.color);
                        const isUploading = uploadingColorIndex === idx;
                        return (
                          <div key={ci.color} className="space-y-1.5">
                            <div className="flex items-center gap-1.5">
                              <span
                                className="h-3 w-3 rounded-full border border-black/10"
                                style={{ background: col?.swatch }}
                              />
                              <span className="text-xs font-medium text-foreground">{ci.color}</span>
                            </div>
                            {ci.image_url ? (
                              <div className="relative rounded-lg overflow-hidden border border-border">
                                <img
                                  src={ci.image_url}
                                  alt={ci.color}
                                  className="w-full h-28 object-cover"
                                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                                />
                                <button
                                  type="button"
                                  onClick={() => removeColorImage(idx)}
                                  className="absolute top-1 right-1 h-5 w-5 rounded-full bg-destructive text-white flex items-center justify-center hover:bg-destructive/80"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </div>
                            ) : (
                              <label className="flex flex-col items-center justify-center h-28 rounded-lg border-2 border-dashed border-border cursor-pointer hover:bg-muted/40 transition-colors">
                                {isUploading ? (
                                  <p className="text-xs text-muted-foreground">Uploading…</p>
                                ) : (
                                  <>
                                    <ImagePlus className="h-6 w-6 text-muted-foreground mb-1" />
                                    <p className="text-xs text-muted-foreground">Upload photo</p>
                                  </>
                                )}
                                <input
                                  type="file"
                                  accept="image/*"
                                  className="hidden"
                                  onChange={(e) =>
                                    e.target.files?.[0] && handleColorImageUpload(e.target.files[0], idx)
                                  }
                                />
                              </label>
                            )}
                            {/* URL paste fallback */}
                            <Input
                              className="text-[11px] h-7 px-2"
                              placeholder="Or paste URL…"
                              value={ci.image_url}
                              onChange={(e) => {
                                const updated = [...formData.color_images];
                                updated[idx] = { ...updated[idx], image_url: e.target.value };
                                setFormData({ ...formData, color_images: updated });
                              }}
                            />
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Fallback single image when no colors selected */}
                  {formData.color_images.length === 0 && (
                    <div>
                      <Label className="text-xs text-muted-foreground">
                        No colour selected — upload a single default photo
                      </Label>
                      {formData.image_url ? (
                        <div className="relative mt-1 rounded-lg overflow-hidden border border-border">
                          <img
                            src={formData.image_url}
                            alt="Preview"
                            className="w-full h-36 object-cover"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                          />
                          <button
                            type="button"
                            onClick={() => setFormData({ ...formData, image_url: "" })}
                            className="absolute top-1.5 right-1.5 h-6 w-6 rounded-full bg-destructive text-white flex items-center justify-center hover:bg-destructive/80"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ) : (
                        <label className="mt-1 flex flex-col items-center justify-center h-36 rounded-lg border-2 border-dashed border-border cursor-pointer hover:bg-muted/40 transition-colors">
                          <ImagePlus className="h-8 w-8 text-muted-foreground mb-2" />
                          <p className="text-xs text-muted-foreground">Click to upload photo</p>
                          <p className="text-[10px] text-muted-foreground/60 mt-0.5">JPG, PNG, WEBP</p>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              const ext = file.name.split(".").pop();
                              const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
                              const { error } = await supabase.storage.from("products").upload(fileName, file, { upsert: true });
                              if (error) { toast({ title: "Upload failed", description: error.message, variant: "destructive" }); return; }
                              const { data } = supabase.storage.from("products").getPublicUrl(fileName);
                              setFormData((prev) => ({ ...prev, image_url: data.publicUrl }));
                              toast({ title: "Image uploaded" });
                            }}
                          />
                        </label>
                      )}
                      <Input
                        className="mt-2 text-xs"
                        placeholder="Or paste image URL…"
                        value={formData.image_url}
                        onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                      />
                    </div>
                  )}
                </div>

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">
                    {editingProduct ? "Update Product" : "Create Product"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          {/* ── Bulk upload dialog ── */}
          <Dialog open={isBulkUploadOpen} onOpenChange={setIsBulkUploadOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Bulk Upload Products</DialogTitle>
                <DialogDescription>
                  Upload a CSV with: name, description, price, sku, brand, category, stock_quantity, min_order_quantity, unit, image_url.
                  <a href="/sample-products.csv" download className="text-blue-500 hover:underline ml-2">
                    Download sample
                  </a>
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <Label htmlFor="csv-file">CSV File</Label>
                <Input
                  id="csv-file"
                  type="file"
                  accept=".csv"
                  onChange={(e) => setCsvFile(e.target.files?.[0] ?? null)}
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsBulkUploadOpen(false)} disabled={isUploading}>
                  Cancel
                </Button>
                <Button onClick={handleBulkUpload} disabled={isUploading}>
                  {isUploading ? "Uploading..." : "Upload"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* ── Products table ── */}
      <Card>
        <CardHeader>
          <CardTitle>Products ({products.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-14" />
                <TableHead>Name</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Colours</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Stock</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((product) => (
                <TableRow key={product.id}>
                  <TableCell>
                    {product.image_url ? (
                      <img
                        src={product.image_url}
                        alt={product.name}
                        className="h-10 w-10 rounded-lg object-cover border border-border"
                      />
                    ) : (
                      <div className="h-10 w-10 rounded-lg bg-muted border border-border flex items-center justify-center text-muted-foreground text-xs">—</div>
                    )}
                  </TableCell>
                  <TableCell className="font-medium">{product.name}</TableCell>
                  <TableCell className="text-muted-foreground text-xs">{product.sku}</TableCell>
                  <TableCell>{product.categories?.name}</TableCell>
                  <TableCell>
                    {product.color_images.length > 0 ? (
                      <div className="flex gap-1">
                        {product.color_images.map((ci) => {
                          const col = JEWELLERY_COLORS.find((c) => c.value === ci.color);
                          return (
                            <span
                              key={ci.color}
                              title={ci.color}
                              className="h-4 w-4 rounded-full border border-black/10 inline-block"
                              style={{ background: col?.swatch ?? "#ccc" }}
                            />
                          );
                        })}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>${product.price.toFixed(2)}</TableCell>
                  <TableCell>{product.stock_quantity}</TableCell>
                  <TableCell>
                    <Badge variant={product.is_active ? "default" : "secondary"}>
                      {product.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => handleEdit(product)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      {product.is_active && (
                        <Button variant="outline" size="sm" onClick={() => handleDelete(product.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {products.length === 0 && (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No products found.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
