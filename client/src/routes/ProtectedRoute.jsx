import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Loader from '../components/Loader';

/** Only logged-in users get through; everyone else is sent to /login (and back afterwards). */
export default function ProtectedRoute({ children }) {
  const { isAuthenticated, loading, loggedOut } = useAuth();
  const location = useLocation();

  if (loading) return <Loader label="Checking your session..." />;
  if (!isAuthenticated && loggedOut) return <Navigate to="/" replace />; // explicit log out -> home
  if (!isAuthenticated) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  return children || <Outlet />;
}
