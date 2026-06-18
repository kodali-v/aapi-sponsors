import { useState, useEffect } from 'react';
import { api } from '../App';
import { TableTab, SOUVENIR_COLS } from './MainPage';

// Public, no-login, editable view of the Souvenir tabs (TOC / VIP Ads).
// Uses the unauthenticated /public/souvenir endpoints. Delete = strike-through (kept).
export default function PublicSouvenir() {
  const [tabs, setTabs] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [rowsByTab, setRowsByTab] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/public/souvenir')
      .then(r => {
        setTabs(r.data.tabs);
        setRowsByTab(r.data.rowsByTab || {});
        if (r.data.tabs.length) setActiveId(r.data.tabs[0].id);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const setActiveRows = (updater) =>
    setRowsByTab(prev => ({ ...prev, [activeId]: typeof updater === 'function' ? updater(prev[activeId] || []) : updater }));

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#718096' }}>Loading…</div>
  );

  const active = tabs.find(t => t.id === activeId);

  return (
    <div>
      <div className="header">
        <div className="header-title">🎁 AAPI Souvenir Ads 2026</div>
        <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>Shared view</span>
      </div>

      {tabs.length === 0 ? (
        <div style={{ textAlign: 'center', color: '#a0aec0', padding: 60 }}>
          No Souvenir tabs are shared yet.
        </div>
      ) : (
        <>
          <div className="tabs">
            {tabs.map(t => (
              <div key={t.id} className={`tab${t.id === activeId ? ' active' : ''}`} onClick={() => setActiveId(t.id)}>
                🎁 {t.name}
              </div>
            ))}
          </div>

          {active && (
            <TableTab
              key={activeId}
              rows={rowsByTab[activeId] || []}
              setRows={setActiveRows}
              tabId={activeId}
              cols={SOUVENIR_COLS}
              noun="ad"
              title={active.name}
              apiBase="/public/souvenir"
              strikeDelete
            />
          )}
        </>
      )}
    </div>
  );
}
