import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate } from 'react-router-dom';
import LocationSelector from './components/LocationSelector';
import VendorList from './components/VendorList';
import NegotiationRoom from './components/NegotiationRoom';
import ItemSelector from './components/ItemSelector';
import SellerInterface from './components/SellerInterface';
import Login from './components/Login';
import SellerDashboard from './components/SellerDashboard';

// Protected Route Component
const ProtectedRoute = ({ children, isAuthenticated }: { children: React.ReactNode, isAuthenticated: boolean }) => {
  if (!isAuthenticated) {
    return <Navigate to="/buyer/login" replace />;
  }
  return <>{children}</>;
};

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userType, setUserType] = useState<'buyer' | 'seller' | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check if user is already logged in
    const storedUserType = localStorage.getItem('userType');
    const storedUserId = localStorage.getItem('userId');
    if (storedUserType && storedUserId) {
      setIsAuthenticated(true);
      setUserType(storedUserType as 'buyer' | 'seller');
    }
    setIsLoading(false);
  }, []);

  const handleLogin = (type: 'buyer' | 'seller') => {
    setIsAuthenticated(true);
    setUserType(type);
  };

  const handleLogout = () => {
    const previousUserType = userType;
    localStorage.clear();
    setIsAuthenticated(false);
    setUserType(null);
    if (previousUserType === 'seller') {
      window.location.href = '/seller/login';
    } else {
      window.location.href = '/buyer/login';
    }
  };

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  return (
    <Router>
      <div className="min-h-screen bg-gray-50 text-gray-900">
        {isAuthenticated && (
          <header className="bg-white shadow p-4 sticky top-0 z-10">
            <div className="container mx-auto flex justify-between items-center">
              <Link to="/" className="text-xl font-bold text-green-700 flex items-center gap-2">
                🌾 DharmaVyāpaara
              </Link>
              <div className="flex items-center gap-4">
                <div className="text-sm text-gray-600 hidden md:block">
                  Logged in as: <span className="font-semibold">{localStorage.getItem('userName')}</span>
                  {' '}({userType === 'buyer' ? 'Buyer' : 'Seller'})
                </div>
                <button
                  onClick={handleLogout}
                  className="text-sm text-red-600 hover:text-red-800 font-medium"
                >
                  Logout
                </button>
              </div>
            </div>
          </header>
        )}

        <main className="container mx-auto p-4">
          <Routes>
            <Route path="/buyer/login" element={<Login onLogin={handleLogin} initialMode="buyer" />} />
            <Route path="/seller/login" element={<Login onLogin={handleLogin} initialMode="seller" />} />
            <Route path="/login" element={<Navigate to="/buyer/login" replace />} />

            {/* Protected Routes */}
            <Route path="/locations" element={
              <ProtectedRoute isAuthenticated={isAuthenticated}>
                <LocationSelector />
              </ProtectedRoute>
            } />

            <Route path="/" element={
              <ProtectedRoute isAuthenticated={isAuthenticated}>
                {userType === 'seller' ? <Navigate to="/seller-dashboard" replace /> : <Navigate to="/locations" replace />}
              </ProtectedRoute>
            } />

            <Route path="/vendors" element={
              <ProtectedRoute isAuthenticated={isAuthenticated}>
                <VendorList />
              </ProtectedRoute>
            } />
            <Route path="/select-item/:vendorId" element={
              <ProtectedRoute isAuthenticated={isAuthenticated}>
                <ItemSelector />
              </ProtectedRoute>
            } />
            <Route path="/negotiate/:vendorId" element={
              <ProtectedRoute isAuthenticated={isAuthenticated}>
                <NegotiationRoom />
              </ProtectedRoute>
            } />

            <Route path="/seller-dashboard" element={
              <ProtectedRoute isAuthenticated={isAuthenticated}>
                <SellerDashboard />
              </ProtectedRoute>
            } />
            <Route path="/seller/:vendorId" element={
              <ProtectedRoute isAuthenticated={isAuthenticated}>
                <SellerInterface />
              </ProtectedRoute>
            } />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
