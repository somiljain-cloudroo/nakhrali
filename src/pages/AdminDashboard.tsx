import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Users,
  Package,
  ShoppingCart,
  Building2,
  TrendingUp,
  DollarSign,
  UserPlus,
  Settings
} from "lucide-react";
import { OrderManagement } from "@/components/admin/OrderManagement";
import { ProductManagement } from "@/components/admin/ProductManagement";
import { AccountManagement } from "@/components/admin/AccountManagement";
import { UserInvitation } from "@/components/admin/UserInvitation";
import { UserManagement } from "@/components/admin/UserManagement";
import { AdminStats } from "@/components/admin/AdminStats";
import { AccountContactRelationship } from "@/components/admin/AccountContactRelationship";

const AdminDashboard = () => {
  const { isAdmin, isSalesAdmin, loading } = useAuth();
  const [activeTab, setActiveTab] = useState("overview");

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading admin dashboard...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin && !isSalesAdmin) {
    return <Navigate to="/" replace />;
  }

  const navigationItems = [
    { id: "overview", label: "Overview", icon: TrendingUp },
    { id: "orders", label: "Orders", icon: ShoppingCart },
    { id: "products", label: "Products", icon: Package },
    { id: "accounts", label: "Accounts", icon: Building2 },
    { id: "users", label: "Users", icon: Users },
    { id: "invite", label: "Invite Users", icon: UserPlus },
    { id: "account-contacts", label: "Account Contacts", icon: Settings },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case "overview":
        return <AdminStats />;
      case "orders":
        return <OrderManagement />;
      case "products":
        return <ProductManagement />;
      case "accounts":
        return <AccountManagement />;
      case "users":
        return <UserManagement />;
      case "invite":
        return <UserInvitation />;
      case "account-contacts":
        return <AccountContactRelationship />;
      default:
        return <AdminStats />;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Admin CRM Dashboard</h1>
              <p className="text-muted-foreground">Manage your business operations</p>
            </div>
            <Badge variant="secondary" className="bg-gradient-primary text-primary-foreground">
              {isAdmin ? "Admin" : "Sales Admin"}
            </Badge>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        <div className="flex gap-6">
          {/* Sidebar Navigation */}
          <div className="w-64 space-y-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Navigation</CardTitle>
              </CardHeader>
              <CardContent className="p-3 space-y-1">
                {navigationItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Button
                      key={item.id}
                      variant={activeTab === item.id ? "default" : "ghost"}
                      className="w-full justify-start"
                      onClick={() => setActiveTab(item.id)}
                    >
                      <Icon className="h-4 w-4 mr-2" />
                      {item.label}
                    </Button>
                  );
                })}
              </CardContent>
            </Card>
          </div>

          {/* Main Content */}
          <div className="flex-1">
            {renderContent()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
