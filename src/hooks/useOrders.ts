import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';
import { useAuth } from '@/hooks/useAuth';

type Order = Database['public']['Tables']['orders']['Row'] & {
  account?: {
    id: string;
    name: string;
    account_number: string;
  };
  ordered_by_contact?: {
    id: string;
    full_name: string;
    email: string;
  };
};
type OrderInsert = Database['public']['Tables']['orders']['Insert'];
type OrderItem = Database['public']['Tables']['order_items']['Row'];

interface CartItem {
  id: string;
  name: string;
  brand: string | null;
  price: number;
  quantity: number;
  unit: string;
  sku: string | null;
}

export function useOrders() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  interface ShippingInfo {
    shippingPostcode?: string;
    shippingMethod?: string;
    shippingCost?: number;
  }

  const createOrder = async (cartItems: CartItem[], notes?: string, accountId?: string, shipping?: ShippingInfo): Promise<{ success: boolean; orderId?: string; order?: any; error?: string }> => {
    if (!user) {
      throw new Error('User not authenticated');
    }

    setLoading(true);
    setError(null);

    try {
      // Calculate totals
      const subtotal = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      const taxAmount = 0; // GST included in prices
      const shippingCost = shipping?.shippingCost ?? 0;
      const totalAmount = subtotal + shippingCost;

      // Generate order number
      const { data: orderNumberData, error: orderNumberError } = await supabase
        .rpc('generate_order_number');

      if (orderNumberError) throw orderNumberError;

      // Create order
      const orderData: any = {
        order_number: orderNumberData,
        ...(accountId 
          ? { account_id: accountId, ordered_by_contact_id: user.id, customer_id: null } 
          : { customer_id: user.id, account_id: null, ordered_by_contact_id: null }
        ),
        subtotal: Number(subtotal.toFixed(2)),
        tax_amount: Number(taxAmount.toFixed(2)),
        total_amount: Number(totalAmount.toFixed(2)),
        notes: notes || null,
        shipping_postcode: shipping?.shippingPostcode || null,
        shipping_method: shipping?.shippingMethod || null,
        shipping_cost: Number((shippingCost).toFixed(2)),
      };

      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert(orderData)
        .select()
        .single();

      if (orderError) throw orderError;

      // Create order items
      const orderItems = cartItems.map(item => ({
        order_id: order.id,
        product_id: item.id,
        quantity: item.quantity,
        unit_price: item.price,
        total_price: Number((item.price * item.quantity).toFixed(2)),
      }));

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItems);

      if (itemsError) throw itemsError;

      // Create initial status history
      const { error: historyError } = await supabase
        .from('order_status_history')
        .insert({
          order_id: order.id,
          old_status: null,
          new_status: 'pending',
          changed_by: user.id,
          notes: 'Order created',
        });

      if (historyError) throw historyError;

      return { order, success: true, orderId: order.id };
    } catch (err) {
      console.error('Error creating order:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to create order';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  const getUserOrders = async () => {
    if (!user) return { orders: [], error: 'User not authenticated' };

    setLoading(true);
    setError(null);

    try {
      const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select(`
          *,
          account:accounts(id, name, account_number),
          ordered_by_contact:profiles(id, full_name, email),
          order_items (
            *,
            product:products (*)
          )
        `)
        .order('created_at', { ascending: false });

      if (ordersError) throw ordersError;

      return { orders: orders || [], error: null };
    } catch (err) {
      console.error('Error fetching orders:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch orders';
      setError(errorMessage);
      return { orders: [], error: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  const getAllOrders = async () => {
    setLoading(true);
    setError(null);

    try {
      const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select(`
          *,
          profiles!orders_customer_id_fkey(full_name, email, company_name),
          account:accounts(id, name, account_number),
          ordered_by_contact:profiles!orders_ordered_by_contact_id_fkey(id, full_name, email),
          order_items (
            *,
            product:products (*)
          )
        `)
        .order('created_at', { ascending: false });

      if (ordersError) throw ordersError;

      return { orders: orders || [], error: null };
    } catch (err) {
      console.error('Error fetching all orders:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch orders';
      setError(errorMessage);
      return { orders: [], error: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  const updateOrderStatus = async (orderId: string, newStatus: Order['status'], notes?: string) => {
    if (!user) {
      throw new Error('User not authenticated');
    }

    setLoading(true);
    setError(null);

    try {
      // Get current order to track old status
      const { data: currentOrder, error: fetchError } = await supabase
        .from('orders')
        .select('status')
        .eq('id', orderId)
        .single();

      if (fetchError) throw fetchError;

      // Update order status
      const { error: updateError } = await supabase
        .from('orders')
        .update({ 
          status: newStatus,
          approved_by: newStatus === 'approved' ? user.id : null,
          approved_at: newStatus === 'approved' ? new Date().toISOString() : null,
        })
        .eq('id', orderId);

      if (updateError) throw updateError;

      // Add to status history
      const { error: historyError } = await supabase
        .from('order_status_history')
        .insert({
          order_id: orderId,
          old_status: currentOrder.status,
          new_status: newStatus,
          changed_by: user.id,
          notes: notes || null,
        });

      if (historyError) throw historyError;

      return { success: true };
    } catch (err) {
      console.error('Error updating order status:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to update order status';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  return {
    createOrder,
    getUserOrders,
    getAllOrders,
    updateOrderStatus,
    loading,
    error,
  };
}