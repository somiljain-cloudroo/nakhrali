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
import { Plus, Edit, Trash2, RefreshCw, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import Papa from "papaparse";

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
  categories?: {
    name: string;
  } | null;
}

interface Category {
  id: string;
  name: string;
}

export const ProductManagement = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isBulkUploadOpen, setIsBulkUploadOpen] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
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
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [productsRes, categoriesRes] = await Promise.all([
        supabase
          .from("products")
          .select(`
            *,
            categories (name)
          `)
          .order("created_at", { ascending: false }),
        supabase.from("categories").select("id, name").eq("is_active", true)
      ]);

      if (productsRes.error) throw productsRes.error;
      if (categoriesRes.error) throw categoriesRes.error;

      setProducts(productsRes.data || []);
      setCategories(categoriesRes.data || []);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast({
        title: "Error",
        description: "Failed to load products",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
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
    });
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
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
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
        image_url: formData.image_url || null,
      };

      let error;
      if (editingProduct) {
        ({ error } = await supabase
          .from("products")
          .update(productData)
          .eq("id", editingProduct.id));
      } else {
        ({ error } = await supabase
          .from("products")
          .insert(productData));
      }

      if (error) throw error;

      toast({
        title: "Success",
        description: `Product ${editingProduct ? 'updated' : 'created'} successfully`,
      });

      setIsDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error) {
      console.error("Error saving product:", error);
      toast({
        title: "Error",
        description: `Failed to ${editingProduct ? 'update' : 'create'} product`,
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (productId: string) => {
    if (!confirm("Are you sure you want to delete this product?")) return;

    try {
      const { error } = await supabase
        .from("products")
        .update({ is_active: false })
        .eq("id", productId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Product deactivated successfully",
      });

      fetchData();
    } catch (error) {
      console.error("Error deleting product:", error);
      toast({
        title: "Error",
        description: "Failed to delete product",
        variant: "destructive",
      });
    }
  };

  const handleBulkUpload = async () => {
    if (!csvFile) {
      toast({
        title: "No file selected",
        description: "Please select a CSV file to upload.",
        variant: "destructive",
      });
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
            category_id:
              categories.find((c) => c.name === row.category)?.id || null,
            stock_quantity: parseInt(row.stock_quantity),
            min_order_quantity: parseInt(row.min_order_quantity) || 1,
            unit: row.unit || "each",
            image_url: row.image_url || null,
          }))
          .filter((p) => p.name && p.price && p.stock_quantity);

        if (productsToInsert.length === 0) {
          toast({
            title: "No valid products found",
            description:
              "The CSV file is empty or does not contain valid product data.",
            variant: "destructive",
          });
          setIsUploading(false);
          return;
        }

        try {
          const { error } = await supabase.functions.invoke("bulk-create-products", {
            body: { products: productsToInsert },
          });

          if (error) throw error;

          toast({
            title: "Success",
            description: `${productsToInsert.length} products uploaded successfully.`,
          });

          setIsBulkUploadOpen(false);
          setCsvFile(null);
          fetchData();
        } catch (error) {
          console.error("Error bulk inserting products:", error);
          toast({
            title: "Error",
            description:
              "Failed to upload products. Check the console for details.",
            variant: "destructive",
          });
        } finally {
          setIsUploading(false);
        }
      },
      error: (error) => {
        console.error("Error parsing CSV:", error);
        toast({
          title: "Error",
          description: "Failed to parse CSV file.",
          variant: "destructive",
        });
        setIsUploading(false);
      },
    });
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="h-4 bg-muted rounded w-full mb-2"></div>
                <div className="h-4 bg-muted rounded w-3/4"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Product Management</h2>
          <p className="text-muted-foreground">
            Manage your product catalog
          </p>
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
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => { resetForm(); setIsDialogOpen(true); }}>
                <Plus className="h-4 w-4 mr-2" />
                Add Product
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>
                  {editingProduct ? "Edit Product" : "Add New Product"}
                </DialogTitle>
                <DialogDescription>
                  Fill in the product details below
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
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

                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>

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
                        {categories.map((category) => (
                          <SelectItem key={category.id} value={category.id}>
                            {category.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

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
                    <Label htmlFor="stock">Stock Quantity *</Label>
                    <Input
                      id="stock"
                      type="number"
                      value={formData.stock_quantity}
                      onChange={(e) => setFormData({ ...formData, stock_quantity: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="min_order">Min Order Qty *</Label>
                    <Input
                      id="min_order"
                      type="number"
                      value={formData.min_order_quantity}
                      onChange={(e) => setFormData({ ...formData, min_order_quantity: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="unit">Unit</Label>
                    <Select
                      value={formData.unit}
                      onValueChange={(value) => setFormData({ ...formData, unit: value })}
                    >
                      <SelectTrigger>
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
                  <div>
                    <Label htmlFor="image_url">Image URL</Label>
                    <Input
                      id="image_url"
                      placeholder="https://..."
                      value={formData.image_url}
                      onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                    />
                  </div>
                </div>

                {/* Image preview */}
                {formData.image_url && (
                  <div className="flex items-center gap-3 p-3 rounded-lg border border-border bg-muted/30">
                    <img
                      src={formData.image_url}
                      alt="Preview"
                      className="h-16 w-16 rounded-lg object-cover border border-border shrink-0"
                      onError={(e) => { (e.target as HTMLImageElement).src = ""; (e.target as HTMLImageElement).style.display = "none"; }}
                    />
                    <p className="text-xs text-muted-foreground break-all">{formData.image_url}</p>
                  </div>
                )}

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

          <Dialog open={isBulkUploadOpen} onOpenChange={setIsBulkUploadOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Bulk Upload Products</DialogTitle>
                <DialogDescription>
                  Upload a CSV file with product data. The file should have the
                  following headers: name, description, price, sku, brand,
                  category, stock_quantity, min_order_quantity, unit, image_url.
                  <a
                    href="/sample-products.csv"
                    download
                    className="text-blue-500 hover:underline ml-2"
                  >
                    Download sample file
                  </a>
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <Label htmlFor="csv-file">CSV File</Label>
                <Input
                  id="csv-file"
                  type="file"
                  accept=".csv"
                  onChange={(e) =>
                    setCsvFile(e.target.files ? e.target.files[0] : null)
                  }
                />
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsBulkUploadOpen(false)}
                  disabled={isUploading}
                >
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

      <Card>
        <CardHeader>
          <CardTitle>Products</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-14"></TableHead>
                <TableHead>Name</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Category</TableHead>
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
                      <div className="h-10 w-10 rounded-lg bg-muted border border-border flex items-center justify-center text-muted-foreground text-xs">
                        —
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="font-medium">{product.name}</TableCell>
                  <TableCell className="text-muted-foreground text-xs">{product.sku}</TableCell>
                  <TableCell>{product.categories?.name}</TableCell>
                  <TableCell>${product.price.toFixed(2)}</TableCell>
                  <TableCell>{product.stock_quantity}</TableCell>
                  <TableCell>
                    <Badge variant={product.is_active ? "default" : "secondary"}>
                      {product.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(product)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      {product.is_active && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(product.id)}
                        >
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
