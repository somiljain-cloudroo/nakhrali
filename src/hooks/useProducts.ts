import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';

type Product = Database['public']['Tables']['products']['Row'] & {
  category?: Database['public']['Tables']['categories']['Row'];
  product_color_stock?: { color: string; stock_quantity: number }[];
};

type Category = Database['public']['Tables']['categories']['Row'];

export function useProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      console.log('useProducts: Starting to load data');
      setLoading(true);
      setError(null);
      
      // Load categories
      console.log('useProducts: Loading categories');
      const { data: categoriesData, error: categoriesError } = await supabase
        .from('categories')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (categoriesError) {
        console.error('useProducts: Categories error:', categoriesError);
        throw categoriesError;
      }
      console.log('useProducts: Categories loaded:', categoriesData?.length);

      // Load products with category info
      console.log('useProducts: Loading products');
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select(`
          *,
          category:categories(*),
          product_color_stock(color, stock_quantity)
        `)
        .eq('is_active', true)
        .order('name');

      if (productsError) {
        console.error('useProducts: Products error:', productsError);
        throw productsError;
      }
      console.log('useProducts: Products loaded:', productsData?.length);

      setCategories(categoriesData || []);
      setProducts(productsData || []);
      setError(null);
      console.log('useProducts: Data loaded successfully', { products: productsData?.length, categories: categoriesData?.length });
    } catch (err) {
      console.error('useProducts: Error loading data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      console.log('useProducts: Setting loading to false');
      setLoading(false);
    }
  };

  const getProductsByCategory = (categoryName: string) => {
    if (categoryName === 'all') return products;
    return products.filter(product => 
      product.category?.name.toLowerCase() === categoryName.toLowerCase()
    );
  };

  return {
    products,
    categories,
    loading,
    error,
    refetch: loadData,
    getProductsByCategory,
  };
}