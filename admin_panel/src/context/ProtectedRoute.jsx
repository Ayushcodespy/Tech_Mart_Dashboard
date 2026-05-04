import { Navigate, useLocation } from 'react-router-dom';

import { Loader } from '../components/ui/Loader';
import { useAuth } from './AuthContext';

export const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <Loader label="Preparing admin workspace..." />;
  }

  if (!isAuthenticated) {
    return <Navigate to={`/login?next=${encodeURIComponent(location.pathname)}`} replace />;
  }

  return children;
};
