import { createContext, useContext, useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';

const api = axios.create({ baseURL: '/api', withCredentials: true });
export { api };

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export default function App({ children }) {
  const [user, setUser] = useState(undefined);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    api.get('/auth/me')
      .then(r => setUser(r.data))
      .catch(() => { setUser(null); if (location.pathname !== '/login') navigate('/login'); });
  }, []);

  if (user === undefined) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#718096' }}>Loading…</div>
    </div>
  );

  return <AuthContext.Provider value={{ user, setUser }}>{children}</AuthContext.Provider>;
}
