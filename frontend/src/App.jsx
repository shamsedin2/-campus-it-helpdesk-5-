import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { useAuth } from './context/auth';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';

import Login from './pages/Login';
import Register from './pages/Register';
import StudentDashboard from './pages/StudentDashboard';
import CreateTicket from './pages/CreateTicket';
import MyTickets from './pages/MyTickets';
import TicketDetails from './pages/TicketDetails';
import StaffDashboard from './pages/StaffDashboard';
import AllTickets from './pages/AllTickets';
import Reports from './pages/Reports';
import ManageUsers from './pages/ManageUsers';
import NotFound from './pages/NotFound';

function Home() {
  const { user, isStaff } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={isStaff ? '/staff' : '/dashboard'} replace />;
}

function GuestOnly({ children }) {
  const { user } = useAuth();
  return user ? <Navigate to="/" replace /> : children;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<GuestOnly><Login /></GuestOnly>} />
          <Route path="/register" element={<GuestOnly><Register /></GuestOnly>} />
          <Route path="/" element={<Home />} />

          <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            {/* Student pages */}
            <Route path="/dashboard" element={<ProtectedRoute studentOnly><StudentDashboard /></ProtectedRoute>} />
            <Route path="/tickets" element={<ProtectedRoute studentOnly><MyTickets /></ProtectedRoute>} />
            <Route path="/tickets/new" element={<ProtectedRoute studentOnly><CreateTicket /></ProtectedRoute>} />
            {/* Shared: the API decides who may see which ticket */}
            <Route path="/tickets/:id" element={<TicketDetails />} />
            {/* Staff pages */}
            <Route path="/staff" element={<ProtectedRoute staffOnly><StaffDashboard /></ProtectedRoute>} />
            <Route path="/staff/tickets" element={<ProtectedRoute staffOnly><AllTickets /></ProtectedRoute>} />
            <Route path="/staff/reports" element={<ProtectedRoute staffOnly><Reports /></ProtectedRoute>} />
            {/* Admin */}
            <Route path="/admin/users" element={<ProtectedRoute adminOnly><ManageUsers /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
