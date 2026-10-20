import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Loader from '../components/Loader';

/** Only admins get through. Members are sent home, guests to /login. */
export default function AdminRoute({ children }) {
  const { isAuthenticated, isAdmin, loading, loggedOut } = useAuth();
  const location = useLocation();

  if (loading) return <Loader label="Checking your session..." />;
  if (!isAuthenticated && loggedOut) return <Navigate to="/" replace />; // explicit log out -> home
  if (!isAuthenticated) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (!isAdmin) return <Navigate to="/" replace />;
  return children;
}
