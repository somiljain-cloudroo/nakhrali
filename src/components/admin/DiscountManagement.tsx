import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit, RefreshCw, Ban, CheckCircle } from "lucide-react";
import { format } from "date-fns";

interface DiscountCode {
  id: string;
  code: string;
  description: string | null;
  discount_type: "percentage" | "fixed";
  discount_value: number;
  valid_from: string;
  valid_until: string;
  max_uses: number | null;
  times_used: number;
  is_active: boolean;
}

interface FormData {
  code: string;
  description: string;
  discount_type: "percentage" | "fixed";
  discount_value: string;
  valid_from: string;
  valid_until: string;
  max_uses: string;
  is_active: boolean;
}

export const DiscountManagement = () => {
  const [codes, setCodes] = useState<DiscountCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCode, setEditingCode] = useState<DiscountCode | null>(null);
  const { toast } = useToast();

  const emptyForm = (): FormData => ({
    code: "",
    description: "",
    discount_type: "percentage",
    discount_value: "",
    valid_from: "",
    valid_until: "",
    max_uses: "",
    is_active: true,
  });

  const [formData, setFormData] = useState<FormData>(emptyForm());

  useEffect(() => { fetchCodes(); }, []);

  const fetchCodes = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("discount_codes")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setCodes((data as unknown as DiscountCode[]) || []);
    } catch (error) {
      console.error("Error fetching discount codes:", error);
      toast({ title: "Error", description: "Failed to load discount codes", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData(emptyForm());
    setEditingCode(null);
  };

  const handleEdit = (dc: DiscountCode) => {
    setEditingCode(dc);
    setFormData({
      code: dc.code,
      description: dc.description || "",
      discount_type: dc.discount_type,
      discount_value: dc.discount_value.toString(),
      valid_from: dc.valid_from.slice(0, 10),
      valid_until: dc.valid_until.slice(0, 10),
      max_uses: dc.max_uses?.toString() || "",
      is_active: dc.is_active,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const discountValue = parseFloat(formData.discount_value);
      if (formData.discount_type === "percentage" && discountValue > 100) {
        toast({ title: "Invalid value", description: "A percentage discount can't exceed 100.", variant: "destructive" });
        return;
      }

      const codeData = {
        code: formData.code.trim(),
        description: formData.description || null,
        discount_type: formData.discount_type,
        discount_value: discountValue,
        valid_from: formData.valid_from,
        valid_until: formData.valid_until,
        max_uses: formData.max_uses ? parseInt(formData.max_uses) : null,
        is_active: formData.is_active,
      };

      let error: { message?: string } | null = null;
      if (editingCode) {
        const { data: rows, error: updateError } = await supabase
          .from("discount_codes")
          .update(codeData)
          .eq("id", editingCode.id)
          .select("id");
        error = updateError;
        if (!updateError && (!rows || rows.length === 0)) {
          error = new Error("Update blocked — check your admin permissions");
        }
      } else {
        const { error: insertError } = await supabase.from("discount_codes").insert(codeData);
        error = insertError;
      }

      if (error) throw error;

      toast({ title: "Success", description: `Discount code ${editingCode ? "updated" : "created"} successfully` });
      setIsDialogOpen(false);
      resetForm();
      fetchCodes();
    } catch (error) {
      console.error("Error saving discount code:", error);
      const message = (error as { message?: string })?.message || `Failed to ${editingCode ? "update" : "create"} discount code`;
      toast({ title: "Error", description: message, variant: "destructive" });
    }
  };

  const handleToggleActive = async (dc: DiscountCode) => {
    try {
      const { error } = await supabase
        .from("discount_codes")
        .update({ is_active: !dc.is_active })
        .eq("id", dc.id);
      if (error) throw error;
      toast({ title: "Success", description: `Discount code ${dc.is_active ? "deactivated" : "activated"}` });
      fetchCodes();
    } catch (error) {
      console.error("Error toggling discount code:", error);
      toast({ title: "Error", description: "Failed to update discount code", variant: "destructive" });
    }
  };

  const formatValue = (dc: DiscountCode) =>
    dc.discount_type === "percentage" ? `${dc.discount_value}%` : `$${dc.discount_value.toFixed(2)}`;

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="space-y-4">
            {[...Array(4)].map((_, i) => (
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Discount Codes</h2>
          <p className="text-muted-foreground">Create and manage checkout discount codes</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={fetchCodes} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => { resetForm(); setIsDialogOpen(true); }}>
                <Plus className="h-4 w-4 mr-2" />
                Add Discount Code
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>{editingCode ? "Edit Discount Code" : "Add Discount Code"}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="code">Code</Label>
                  <Input
                    id="code"
                    placeholder="e.g. SAVE10"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="description">Description (Optional)</Label>
                  <Textarea
                    id="description"
                    placeholder="Internal note about this code"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={2}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="discount_type">Type</Label>
                    <Select
                      value={formData.discount_type}
                      onValueChange={(v) => setFormData({ ...formData, discount_type: v as "percentage" | "fixed" })}
                    >
                      <SelectTrigger id="discount_type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="percentage">Percentage</SelectItem>
                        <SelectItem value="fixed">Fixed Amount</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="discount_value">
                      Value {formData.discount_type === "percentage" ? "(%)" : "($ AUD)"}
                    </Label>
                    <Input
                      id="discount_value"
                      type="number"
                      step="0.01"
                      min="0"
                      max={formData.discount_type === "percentage" ? "100" : undefined}
                      value={formData.discount_value}
                      onChange={(e) => setFormData({ ...formData, discount_value: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="valid_from">Valid From</Label>
                    <Input
                      id="valid_from"
                      type="date"
                      value={formData.valid_from}
                      onChange={(e) => setFormData({ ...formData, valid_from: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="valid_until">Valid Until</Label>
                    <Input
                      id="valid_until"
                      type="date"
                      value={formData.valid_until}
                      onChange={(e) => setFormData({ ...formData, valid_until: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="max_uses">Max Uses (Optional — blank for unlimited)</Label>
                  <Input
                    id="max_uses"
                    type="number"
                    min="1"
                    placeholder="Unlimited"
                    value={formData.max_uses}
                    onChange={(e) => setFormData({ ...formData, max_uses: e.target.value })}
                  />
                </div>

                <DialogFooter>
                  <Button type="submit">{editingCode ? "Save Changes" : "Create Code"}</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Codes</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Value</TableHead>
                <TableHead>Valid From</TableHead>
                <TableHead>Valid Until</TableHead>
                <TableHead>Uses</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {codes.map((dc) => (
                <TableRow key={dc.id}>
                  <TableCell className="font-mono font-medium">{dc.code}</TableCell>
                  <TableCell className="capitalize">{dc.discount_type}</TableCell>
                  <TableCell>{formatValue(dc)}</TableCell>
                  <TableCell>{format(new Date(dc.valid_from), "MMM dd, yyyy")}</TableCell>
                  <TableCell>{format(new Date(dc.valid_until), "MMM dd, yyyy")}</TableCell>
                  <TableCell>{dc.times_used}{dc.max_uses ? ` / ${dc.max_uses}` : " / Unlimited"}</TableCell>
                  <TableCell>
                    <Badge variant={dc.is_active ? "default" : "secondary"}>
                      {dc.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => handleEdit(dc)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleToggleActive(dc)}>
                        {dc.is_active ? <Ban className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {codes.length === 0 && (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No discount codes yet.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
