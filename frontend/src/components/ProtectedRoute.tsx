import { Navigate } from "react-router-dom";
import { useAuth } from "../AuthContext";

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="auth-page">
        <div className="auth-card" style={{ textAlign: "center", padding: "3rem" }}>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
