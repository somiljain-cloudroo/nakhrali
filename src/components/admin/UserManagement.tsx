import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { RefreshCw, CheckCircle, XCircle, Clock } from "lucide-react";

type UserRow = {
  id: string;
  email: string;
  full_name: string | null;
  company_name: string | null;
  role: string;
  is_active: boolean;
  created_at: string;
};

export const UserManagement = () => {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("profiles")
        .select("id, email, full_name, company_name, role, is_active, created_at")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error("Error fetching users:", error);
      toast({ title: "Error", description: "Failed to load users", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleApprove = async (user: UserRow) => {
    setApprovingId(user.id);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ is_active: true })
        .eq("id", user.id);

      if (error) throw error;

      await supabase.functions.invoke("send-account-approved-email", {
        body: { email: user.email, name: user.full_name || user.email },
      });

      toast({ title: "Approved", description: `${user.email} now has access.` });
      fetchUsers();
    } catch (error) {
      console.error("Error approving user:", error);
      toast({ title: "Error", description: "Failed to approve user", variant: "destructive" });
    } finally {
      setApprovingId(null);
    }
  };

  const handleRevoke = async (user: UserRow) => {
    if (!confirm(`Revoke access for ${user.email}?`)) return;
    setRevokingId(user.id);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ is_active: false })
        .eq("id", user.id);

      if (error) throw error;
      toast({ title: "Access revoked", description: `${user.email} can no longer access the store.` });
      fetchUsers();
    } catch (error) {
      console.error("Error revoking user:", error);
      toast({ title: "Error", description: "Failed to revoke access", variant: "destructive" });
    } finally {
      setRevokingId(null);
    }
  };

  const pending = users.filter(u => !u.is_active && u.role === "customer");
  const active = users.filter(u => u.is_active);

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 space-y-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="animate-pulse h-4 bg-muted rounded w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">User Management</h2>
          <p className="text-muted-foreground">Approve sign-up requests and manage store access</p>
        </div>
        <Button onClick={fetchUsers} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Pending Approvals */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-amber-500" />
            Pending Approval
            {pending.length > 0 && (
              <Badge className="bg-amber-100 text-amber-800 ml-2">{pending.length}</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {pending.length === 0 ? (
            <p className="text-muted-foreground text-sm py-4 text-center">No pending requests.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Signed Up</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pending.map(user => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.full_name || "—"}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>{user.company_name || "—"}</TableCell>
                    <TableCell>{formatDate(user.created_at)}</TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        onClick={() => handleApprove(user)}
                        disabled={approvingId === user.id}
                        className="bg-green-600 hover:bg-green-700 text-white"
                      >
                        <CheckCircle className="h-4 w-4 mr-1" />
                        {approvingId === user.id ? "Approving…" : "Approve"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Users with Access */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            Active Users
            <Badge className="bg-green-100 text-green-800 ml-2">{active.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {active.map(user => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.full_name || "—"}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>{user.company_name || "—"}</TableCell>
                  <TableCell>
                    <Badge variant={user.role === "admin" ? "default" : "secondary"} className="capitalize">
                      {user.role}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatDate(user.created_at)}</TableCell>
                  <TableCell>
                    {user.role !== "admin" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleRevoke(user)}
                        disabled={revokingId === user.id}
                        className="text-red-600 border-red-200 hover:bg-red-50"
                      >
                        <XCircle className="h-4 w-4 mr-1" />
                        {revokingId === user.id ? "Revoking…" : "Revoke"}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {active.length === 0 && (
            <p className="text-muted-foreground text-sm py-4 text-center">No active users.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
