import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { DollarSign, User, Hash, Truck, ChevronDown, ChevronUp } from "lucide-react";

type Order = Tables<"orders">;

interface OrderItem {
  id: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  product: { name: string; sku: string | null; unit: string } | null;
}

const StatCard = ({ title, value, icon: Icon }: { title: string; value: string; icon: React.ElementType }) => (
  <Card>
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium">{title}</CardTitle>
      <Icon className="h-4 w-4 text-muted-foreground" />
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-bold">{value}</div>
    </CardContent>
  </Card>
);

export const ProfilePage = () => {
  const { profile, loading: authLoading } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [orderItems, setOrderItems] = useState<Record<string, OrderItem[]>>({});

  useEffect(() => {
    const fetchOrders = async () => {
      if (!profile) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const { data, error } = await supabase
          .from("orders")
          .select("*")
          .or(`customer_id.eq.${profile.id},ordered_by_contact_id.eq.${profile.id}`)
          .order("created_at", { ascending: false });

        if (error) throw new Error(error.message);
        setOrders(data || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch orders.");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    if (!authLoading) {
      fetchOrders();
    }
  }, [profile, authLoading]);

  const toggleOrder = async (orderId: string) => {
    if (expandedOrder === orderId) {
      setExpandedOrder(null);
      return;
    }
    setExpandedOrder(orderId);
    if (!orderItems[orderId]) {
      const { data } = await supabase
        .from("order_items")
        .select("id, quantity, unit_price, total_price, product:products(name, sku, unit)")
        .eq("order_id", orderId);
      setOrderItems((prev) => ({ ...prev, [orderId]: (data as unknown as OrderItem[]) || [] }));
    }
  };

  const balanceDue = orders
    .filter(order => order.status !== 'completed' && order.status !== 'paid')
    .reduce((acc, order) => acc + (order.total_amount || 0), 0);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: "AUD",
    }).format(value);
  };

  if (authLoading || loading) {
    return (
      <div className="container mx-auto p-4">
        <div className="animate-pulse space-y-4">
          <div className="h-24 bg-muted rounded-lg"></div>
          <div className="h-48 bg-muted rounded-lg"></div>
          <div className="h-64 bg-muted rounded-lg"></div>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="container mx-auto p-4">
        <Alert variant="destructive">
          <AlertTitle>Not Logged In</AlertTitle>
          <AlertDescription>
            You must be logged in to view your profile.
          </AlertDescription>
        </Alert>
      </div>
    );
  }
  
  if (error) {
     return (
      <div className="container mx-auto p-4">
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 space-y-6">
      <h1 className="text-3xl font-bold">My Profile</h1>

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard 
          title="Balance Due" 
          value={formatCurrency(balanceDue)} 
          icon={DollarSign} 
        />
        <StatCard 
          title="Total Orders" 
          value={orders.length.toString()} 
          icon={Hash} 
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User />
              Customer Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <p className="font-semibold">Name</p>
              <p className="text-muted-foreground">{profile.full_name}</p>
            </div>
            <div>
              <p className="font-semibold">Email</p>
              <p className="text-muted-foreground">{profile.email}</p>
            </div>
            <div>
              <p className="font-semibold">Company</p>
              <p className="text-muted-foreground">{profile.company_name || 'N/A'}</p>
            </div>
             <div>
              <p className="font-semibold">Address</p>
              <p className="text-muted-foreground">
                {profile.address ? `${profile.address}, ${profile.city}, ${profile.state} ${profile.postal_code}` : 'N/A'}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Truck />
              Past Orders
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order #</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.length > 0 ? (
                  orders.map((order) => (
                    <>
                      <TableRow key={order.id} className="cursor-pointer hover:bg-muted/50" onClick={() => toggleOrder(order.id)}>
                        <TableCell className="font-medium">{order.order_number}</TableCell>
                        <TableCell>{new Date(order.created_at).toLocaleDateString()}</TableCell>
                        <TableCell>{formatCurrency(order.total_amount)}</TableCell>
                        <TableCell><Badge className="capitalize">{order.status}</Badge></TableCell>
                        <TableCell>
                          {expandedOrder === order.id
                            ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
                            : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                        </TableCell>
                      </TableRow>
                      {expandedOrder === order.id && (
                        <TableRow key={`${order.id}-items`}>
                          <TableCell colSpan={5} className="bg-muted/30 px-6 pb-4 pt-2">
                            {!orderItems[order.id] ? (
                              <p className="text-sm text-muted-foreground">Loading…</p>
                            ) : orderItems[order.id].length === 0 ? (
                              <p className="text-sm text-muted-foreground">No items found.</p>
                            ) : (
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="text-muted-foreground text-xs uppercase tracking-wide">
                                    <th className="text-left pb-1">Product</th>
                                    <th className="text-center pb-1">Qty</th>
                                    <th className="text-right pb-1">Price</th>
                                    <th className="text-right pb-1">Subtotal</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {orderItems[order.id].map((item) => (
                                    <tr key={item.id} className="border-t border-border/40">
                                      <td className="py-1.5">
                                        <p className="font-medium">{item.product?.name ?? "—"}</p>
                                        {item.product?.sku && <p className="text-xs text-muted-foreground">{item.product.sku}</p>}
                                      </td>
                                      <td className="text-center py-1.5">{item.quantity} {item.product?.unit}</td>
                                      <td className="text-right py-1.5">{formatCurrency(item.unit_price)}</td>
                                      <td className="text-right py-1.5 font-semibold">{formatCurrency(item.total_price)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            )}
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center">
                      You have no past orders.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
