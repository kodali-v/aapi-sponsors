import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, useAuth } from '../App';

export default function LoginPage() {
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { setUser } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const r = await api.post('/auth/login', { name: name.trim(), password });
      setUser(r.data);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
    } finally { setLoading(false); }
  };

  return (
    <div className="login-page">
      <div className="login-box">
        <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#1e3a5f', color: 'white', fontSize: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontWeight: 700 }}>★</div>
        <h2 style={{ textAlign: 'center', color: '#1e3a5f', marginBottom: 4, fontSize: 20 }}>AAPI Sponsors</h2>
        <p style={{ textAlign: 'center', color: '#718096', fontSize: 13, marginBottom: 24 }}>Schedule & Deliverables Tracker</p>
        {error && <div className="alert alert-error">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 14 }}>
            <label className="form-label">Your Name</label>
            <input className="form-input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Vijaya Kodali" autoFocus required />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label className="form-label">Password</label>
            <input className="form-input" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Board password" required />
          </div>
          <button type="submit" className="btn btn-navy" style={{ width: '100%', justifyContent: 'center', padding: '10px' }} disabled={loading || !name.trim() || !password}>
            {loading ? 'Logging in…' : 'Log In →'}
          </button>
        </form>
      </div>
    </div>
  );
}
