import { ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";

export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen p-8 space-y-4">
        <div className="skeleton h-12 w-1/3" />
        <div className="grid gap-4 md:grid-cols-4">
          {[0,1,2,3].map(i => <div key={i} className="skeleton h-28" />)}
        </div>
        <div className="skeleton h-64" />
      </div>
    );
  }
  if (!user) return <Navigate to="/auth" replace />;
  return <>{children}</>;
}
