import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Eye, Check, X, RefreshCw } from "lucide-react";
import { format } from "date-fns";

interface Order {
  id: string;
  order_number: string;
  status: string;
  total_amount: number;
  created_at: string;
  notes: string | null;
  customer_id: string | null;
  account_id: string | null;
  profiles?: {
    full_name: string;
    email: string;
  } | null;
  accounts?: {
    name: string;
  } | null;
}

export const OrderManagement = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [approvalNotes, setApprovalNotes] = useState("");
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    fetchOrders();
  }, [statusFilter]);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from("orders")
        .select("*")
        .order("created_at", { ascending: false });

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }
      
      const { data: orderData, error: orderError } = await query;
      if (orderError) throw orderError;

      // Fetch profile data for customer orders
      const customerIds = orderData?.filter(order => order.customer_id).map(order => order.customer_id) || [];
      const accountIds = orderData?.filter(order => order.account_id).map(order => order.account_id) || [];

      const [profilesRes, accountsRes] = await Promise.all([
        customerIds.length > 0 
          ? supabase.from("profiles").select("id, full_name, email").in("id", customerIds)
          : { data: [], error: null },
        accountIds.length > 0
          ? supabase.from("accounts").select("id, name").in("id", accountIds)
          : { data: [], error: null }
      ]);

      // Combine the data
      const ordersWithDetails = orderData?.map(order => ({
        ...order,
        profiles: order.customer_id ? profilesRes.data?.find(p => p.id === order.customer_id) || null : null,
        accounts: order.account_id ? accountsRes.data?.find(a => a.id === order.account_id) || null : null,
      })) || [];

      setOrders(ordersWithDetails);
    } catch (error) {
      console.error("Error fetching orders:", error);
      toast({
        title: "Error",
        description: "Failed to load orders",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const updateOrderStatus = async (orderId: string, newStatus: string, notes?: string) => {
    try {
      const { data: updated, error } = await supabase
        .from("orders")
        .update({
          status: newStatus,
          ...(newStatus === 'approved' && { approved_at: new Date().toISOString(), approved_by: user?.id }),
          ...(notes && { notes })
        })
        .eq("id", orderId)
        .select("id");

      if (error) throw error;
      if (!updated || updated.length === 0) throw new Error("Update blocked — check admin permissions");

      if (newStatus === 'approved') {
        // The function is now self-contained and will fetch the customer email.
        // We only need to pass the order object.
        await supabase.functions.invoke('send-order-approval-email', {
          body: { order: selectedOrder },
        });
      }

      // Insert status history
      await supabase
        .from("order_status_history")
        .insert({
          order_id: orderId,
          old_status: selectedOrder?.status,
          new_status: newStatus,
          changed_by: user?.id,
          notes: notes || null
        });

      toast({
        title: "Success",
        description: `Order ${newStatus === 'approved' ? 'approved' : 'rejected'} successfully`,
      });

      fetchOrders();
      setSelectedOrder(null);
      setApprovalNotes("");
    } catch (error) {
      console.error("Error updating order:", error);
      toast({
        title: "Error",
        description: "Failed to update order status",
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      pending: "secondary",
      approved: "default",
      rejected: "destructive",
      completed: "default",
    } as const;

    const colors = {
      pending: "bg-orange-100 text-orange-800",
      approved: "bg-green-100 text-green-800",
      rejected: "bg-red-100 text-red-800",
      completed: "bg-blue-100 text-blue-800",
    };

    return (
      <Badge variant={variants[status as keyof typeof variants] || "secondary"} 
             className={colors[status as keyof typeof colors]}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const getCustomerName = (order: Order) => {
    if (order.profiles?.full_name) {
      return order.profiles.full_name;
    }
    if (order.accounts?.name) {
      return order.accounts.name;
    }
    return "Unknown Customer";
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
          <h2 className="text-2xl font-bold">Order Management</h2>
          <p className="text-muted-foreground">
            Review and approve customer orders
          </p>
        </div>
        <Button onClick={fetchOrders} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Orders</CardTitle>
            <div className="flex gap-2">
              {["all", "pending", "approved", "rejected"].map((status) => (
                <Button
                  key={status}
                  variant={statusFilter === status ? "default" : "outline"}
                  size="sm"
                  onClick={() => setStatusFilter(status)}
                >
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order #</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((order) => (
                <TableRow key={order.id}>
                  <TableCell className="font-medium">
                    {order.order_number}
                  </TableCell>
                  <TableCell>{getCustomerName(order)}</TableCell>
                  <TableCell>${order.total_amount.toFixed(2)}</TableCell>
                  <TableCell>{getStatusBadge(order.status)}</TableCell>
                  <TableCell>
                    {format(new Date(order.created_at), "MMM dd, yyyy")}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedOrder(order)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl">
                          <DialogHeader>
                            <DialogTitle>Order Details</DialogTitle>
                            <DialogDescription>
                              Review order {selectedOrder?.order_number}
                            </DialogDescription>
                          </DialogHeader>
                          {selectedOrder && (
                            <div className="space-y-4">
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <label className="text-sm font-medium">Customer</label>
                                  <p className="text-sm text-muted-foreground">
                                    {getCustomerName(selectedOrder)}
                                  </p>
                                </div>
                                <div>
                                  <label className="text-sm font-medium">Total Amount</label>
                                  <p className="text-sm text-muted-foreground">
                                    ${selectedOrder.total_amount.toFixed(2)}
                                  </p>
                                </div>
                              </div>
                              {selectedOrder.notes && (
                                <div>
                                  <label className="text-sm font-medium">Customer Notes</label>
                                  <p className="text-sm text-muted-foreground bg-muted p-2 rounded">
                                    {selectedOrder.notes}
                                  </p>
                                </div>
                              )}
                              {selectedOrder.status === 'pending' && (
                                <div className="space-y-3">
                                  <label className="text-sm font-medium">Approval Notes</label>
                                  <Textarea
                                    placeholder="Add notes for this decision..."
                                    value={approvalNotes}
                                    onChange={(e) => setApprovalNotes(e.target.value)}
                                  />
                                </div>
                              )}
                            </div>
                          )}
                          {selectedOrder?.status === 'pending' && (
                            <DialogFooter className="gap-2">
                              <Button
                                variant="destructive"
                                onClick={() => updateOrderStatus(selectedOrder.id, 'rejected', approvalNotes)}
                              >
                                <X className="h-4 w-4 mr-2" />
                                Reject
                              </Button>
                              <Button
                                onClick={() => updateOrderStatus(selectedOrder.id, 'approved', approvalNotes)}
                              >
                                <Check className="h-4 w-4 mr-2" />
                                Approve
                              </Button>
                            </DialogFooter>
                          )}
                        </DialogContent>
                      </Dialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {orders.length === 0 && (
            <div className="text-center py-8">
              <p className="text-muted-foreground">
                No orders found for the selected filter.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
