import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/auth';

export default function ProtectedRoute({ children, staffOnly = false, adminOnly = false, studentOnly = false }) {
  const { user, isStaff, isAdmin } = useAuth();
  const location = useLocation();
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (adminOnly && !isAdmin) return <Navigate to="/" replace />;
  if (studentOnly && isStaff) return <Navigate to="/staff" replace />;
  if (staffOnly && !isStaff) return <Navigate to="/" replace />;
  return children;
}
