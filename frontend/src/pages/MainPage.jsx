import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, useAuth } from '../App';

// ── Sponsors Panel ────────────────────────────────────────
function SponsorsPanel({ sponsors, onAdd, onDelete, onStatusChange, onDragStart }) {
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newStatus, setNewStatus] = useState('confirmed');

  const handleAdd = async () => {
    if (!newName.trim()) return;
    await onAdd(newName.trim(), newStatus);
    setNewName(''); setAdding(false);
  };

  const confirmed = sponsors.filter(s => s.status === 'confirmed');
  const probable = sponsors.filter(s => s.status === 'probable');

  return (
    <div className="sponsors-panel">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: '#1e3a5f' }}>Sponsors</div>
        <button className="btn btn-navy btn-sm" onClick={() => setAdding(v => !v)}>+ Add</button>
      </div>

      {adding && (
        <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 10, padding: 12, marginBottom: 12 }}>
          <input className="form-input" placeholder="Company name" value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') setAdding(false); }}
            autoFocus style={{ marginBottom: 8 }} />
          <select value={newStatus} onChange={e => setNewStatus(e.target.value)}
            style={{ width: '100%', padding: '7px 10px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 13, marginBottom: 8, fontFamily: 'inherit' }}>
            <option value="confirmed">✅ Confirmed</option>
            <option value="probable">❓ Probable</option>
          </select>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn btn-navy btn-sm" onClick={handleAdd} disabled={!newName.trim()}>Add</button>
            <button className="btn btn-ghost btn-sm" onClick={() => setAdding(false)}>Cancel</button>
          </div>
        </div>
      )}

      {confirmed.length > 0 && (
        <>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#059669', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Confirmed ({confirmed.length})</div>
          {confirmed.map(s => (
            <SponsorChip key={s.id} sponsor={s} onDelete={onDelete} onStatusChange={onStatusChange} onDragStart={onDragStart} />
          ))}
        </>
      )}
      {probable.length > 0 && (
        <>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#d97706', textTransform: 'uppercase', letterSpacing: 1, margin: '10px 0 6px' }}>Probable ({probable.length})</div>
          {probable.map(s => (
            <SponsorChip key={s.id} sponsor={s} onDelete={onDelete} onStatusChange={onStatusChange} onDragStart={onDragStart} />
          ))}
        </>
      )}
    </div>
  );
}

function SponsorChip({ sponsor, onDelete, onStatusChange, onDragStart }) {
  const [showMenu, setShowMenu] = useState(false);
  return (
    <div
      className={`sponsor-chip`}
      draggable
      onDragStart={() => onDragStart(sponsor.id)}
      style={{ borderColor: sponsor.status === 'confirmed' ? '#059669' : '#d97706' }}
    >
      <span style={{ flex: 1, fontSize: 13 }}>{sponsor.name}</span>
      <div style={{ position: 'relative' }}>
        <button className="btn btn-ghost btn-sm" style={{ padding: '2px 6px' }} onClick={() => setShowMenu(v => !v)}>⋮</button>
        {showMenu && (
          <div style={{ position: 'absolute', right: 0, top: '110%', background: 'white', border: '1px solid #e2e8f0', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.12)', zIndex: 50, minWidth: 150, padding: 4 }}>
            <button className="btn btn-ghost btn-sm" style={{ width: '100%', justifyContent: 'flex-start' }}
              onClick={() => { onStatusChange(sponsor.id, sponsor.status === 'confirmed' ? 'probable' : 'confirmed'); setShowMenu(false); }}>
              {sponsor.status === 'confirmed' ? '❓ Mark Probable' : '✅ Mark Confirmed'}
            </button>
            <button className="btn btn-danger btn-sm" style={{ width: '100%', justifyContent: 'flex-start', marginTop: 2 }}
              onClick={() => { if (window.confirm(`Remove ${sponsor.name}?`)) { onDelete(sponsor.id); } setShowMenu(false); }}>
              🗑 Remove
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Schedule Tab ──────────────────────────────────────────
function ScheduleTab({ sponsors, schedule, setSchedule }) {
  const [dragSponsorId, setDragSponsorId] = useState(null);
  const [addingSlot, setAddingSlot] = useState(null); // dayId
  const [addingDay, setAddingDay] = useState(false);
  const [newDayName, setNewDayName] = useState('');
  const [newStart, setNewStart] = useState('');
  const [newEnd, setNewEnd] = useState('');

  const handleDrop = async (slotId) => {
    if (!dragSponsorId) return;
    try {
      const r = await api.post(`/schedule/slots/${slotId}/assign`, { sponsor_id: dragSponsorId });
      setSchedule(prev => prev.map(day => ({
        ...day,
        slots: day.slots.map(slot =>
          slot.id === slotId
            ? { ...slot, assignments: [...slot.assignments.filter(a => a.sponsor_id !== dragSponsorId), r.data] }
            : slot
        )
      })));
    } catch (err) {
      if (err.response?.status !== 409) alert('Failed to assign');
    }
    setDragSponsorId(null);
  };

  const handleRemoveAssignment = async (slotId, sponsorId) => {
    await api.delete(`/schedule/slots/${slotId}/assign/${sponsorId}`);
    setSchedule(prev => prev.map(day => ({
      ...day,
      slots: day.slots.map(slot =>
        slot.id === slotId
          ? { ...slot, assignments: slot.assignments.filter(a => a.sponsor_id !== sponsorId) }
          : slot
      )
    })));
  };

  const handleAddSlot = async (dayId) => {
    if (!newStart || !newEnd) return;
    const r = await api.post(`/schedule/days/${dayId}/slots`, { start_time: newStart, end_time: newEnd });
    setSchedule(prev => prev.map(d => d.id === dayId ? { ...d, slots: [...d.slots, r.data] } : d));
    setNewStart(''); setNewEnd(''); setAddingSlot(null);
  };

  const handleAddDay = async () => {
    if (!newDayName.trim()) return;
    const r = await api.post('/schedule/days', { name: newDayName.trim() });
    setSchedule(prev => [...prev, r.data]);
    setNewDayName(''); setAddingDay(false);
  };

  const handleDeleteDay = async (dayId) => {
    if (!window.confirm('Delete this day and all its slots?')) return;
    await api.delete(`/schedule/days/${dayId}`);
    setSchedule(prev => prev.filter(d => d.id !== dayId));
  };

  const handleDeleteSlot = async (dayId, slotId) => {
    await api.delete(`/schedule/slots/${slotId}`);
    setSchedule(prev => prev.map(d => d.id === dayId ? { ...d, slots: d.slots.filter(s => s.id !== slotId) } : d));
  };

  return (
    <div style={{ display: 'flex', gap: 20, padding: 24, overflow: 'auto', alignItems: 'flex-start' }}>
      {/* Sponsors sidebar */}
      <SponsorsPanel
        sponsors={sponsors}
        onAdd={async (name, status) => {
          const r = await api.post('/sponsors', { name, status });
          sponsors.push(r.data); // will be refreshed
        }}
        onDelete={async (id) => { await api.delete(`/sponsors/${id}`); }}
        onStatusChange={async (id, status) => { await api.put(`/sponsors/${id}`, { status }); }}
        onDragStart={setDragSponsorId}
      />

      {/* Day columns */}
      {schedule.map(day => (
        <div key={day.id} className="day-col">
          <div className="day-header">
            <span>{day.name}</span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="btn btn-sm" style={{ background: 'rgba(255,255,255,0.2)', color: 'white', padding: '2px 8px' }}
                onClick={() => setAddingSlot(addingSlot === day.id ? null : day.id)}>+ Slot</button>
              <button className="btn btn-sm" style={{ background: 'rgba(255,0,0,0.3)', color: 'white', padding: '2px 8px' }}
                onClick={() => handleDeleteDay(day.id)}>✕</button>
            </div>
          </div>

          {addingSlot === day.id && (
            <div style={{ background: '#f0f4f8', padding: 10, border: '1px solid #e2e8f0', borderTop: 'none' }}>
              <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                <input className="form-input" placeholder="Start (e.g. 7:30 AM)" value={newStart} onChange={e => setNewStart(e.target.value)} style={{ flex: 1 }} />
                <input className="form-input" placeholder="End (e.g. 8:15 AM)" value={newEnd} onChange={e => setNewEnd(e.target.value)} style={{ flex: 1 }} />
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="btn btn-navy btn-sm" onClick={() => handleAddSlot(day.id)}>Add</button>
                <button className="btn btn-ghost btn-sm" onClick={() => setAddingSlot(null)}>Cancel</button>
              </div>
            </div>
          )}

          {day.slots.map(slot => (
            <div key={slot.id} className="slot-row">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div className="slot-time">⏰ {slot.start_time} – {slot.end_time}</div>
                <button className="btn btn-danger btn-sm" style={{ padding: '1px 6px', fontSize: 11 }}
                  onClick={() => handleDeleteSlot(day.id, slot.id)}>✕</button>
              </div>
              <div
                className={`slot-drop${dragSponsorId ? ' drag-over' : ''}`}
                onDragOver={e => e.preventDefault()}
                onDrop={() => handleDrop(slot.id)}
              >
                {slot.assignments.length === 0 && <span>Drop sponsor here</span>}
                {slot.assignments.map(a => (
                  <div key={a.id} className={`assigned-chip${a.sponsor_status === 'probable' ? ' probable' : ''}`}>
                    {a.sponsor_name}
                    <span style={{ cursor: 'pointer', opacity: 0.7 }} onClick={() => handleRemoveAssignment(slot.id, a.sponsor_id)}>✕</span>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {day.slots.length === 0 && (
            <div style={{ padding: 16, textAlign: 'center', color: '#a0aec0', fontSize: 13, background: 'white', border: '1px solid #e2e8f0', borderTop: 'none', borderRadius: '0 0 10px 10px' }}>
              No slots yet — click "+ Slot"
            </div>
          )}
        </div>
      ))}

      {/* Add day */}
      {addingDay ? (
        <div style={{ minWidth: 200, background: 'white', border: '1px solid #e2e8f0', borderRadius: 10, padding: 16 }}>
          <input className="form-input" placeholder="Day name (e.g. Sunday)" value={newDayName}
            onChange={e => setNewDayName(e.target.value)} autoFocus
            onKeyDown={e => { if (e.key === 'Enter') handleAddDay(); if (e.key === 'Escape') setAddingDay(false); }}
            style={{ marginBottom: 8 }} />
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn btn-navy btn-sm" onClick={handleAddDay}>Add</button>
            <button className="btn btn-ghost btn-sm" onClick={() => setAddingDay(false)}>Cancel</button>
          </div>
        </div>
      ) : (
        <div style={{ minWidth: 140, border: '2px dashed #cbd5e0', borderRadius: 10, padding: 20,
          display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
          color: '#a0aec0', fontWeight: 600, fontSize: 14, alignSelf: 'flex-start' }}
          onClick={() => setAddingDay(true)}>
          + Add Day
        </div>
      )}
    </div>
  );
}

// ── Notes helpers ─────────────────────────────────────────
const isNotesCol = d => (d?.name || '').trim().toLowerCase() === 'notes';

// Notes content can be legacy ([] / array of strings) or the new { text, bullets } shape
function normalizeNotes(raw) {
  if (Array.isArray(raw)) return { text: '', bullets: raw };
  if (raw && typeof raw === 'object') return { text: raw.text || '', bullets: Array.isArray(raw.bullets) ? raw.bullets : [] };
  return { text: '', bullets: [] };
}

// Paragraph + bullet-point notes cell (the pinned last column)
function NotesCell({ value, onSave }) {
  const norm = normalizeNotes(value);
  const [text, setText] = useState(norm.text);
  const [bullets, setBullets] = useState(norm.bullets);

  const persist = (t, b) => onSave({ text: t, bullets: b.map(x => x).filter(x => x.trim() !== '') });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 220 }}>
      <textarea
        className="note-input"
        style={{ width: '100%', minHeight: 54, resize: 'vertical', fontFamily: 'inherit', padding: '6px 8px' }}
        placeholder="Add notes…"
        value={text}
        onChange={e => setText(e.target.value)}
        onBlur={() => persist(text, bullets)}
      />
      {bullets.length > 0 && (
        <ul className="notes-list" style={{ margin: 0, paddingLeft: 18 }}>
          {bullets.map((b, i) => (
            <li key={i} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <input
                className="note-input"
                style={{ flex: 1, border: 'none', borderBottom: '1px solid #e2e8f0', padding: '2px 2px', fontSize: 12 }}
                value={b}
                placeholder="Bullet…"
                autoFocus={b === ''}
                onChange={e => { const nb = [...bullets]; nb[i] = e.target.value; setBullets(nb); }}
                onBlur={() => persist(text, bullets)}
                onKeyDown={e => {
                  if (e.key === 'Enter') { e.preventDefault(); const nb = [...bullets]; nb.splice(i + 1, 0, ''); setBullets(nb); }
                  if (e.key === 'Backspace' && b === '') { e.preventDefault(); const nb = bullets.filter((_, j) => j !== i); setBullets(nb); persist(text, nb); }
                }}
              />
              <span style={{ cursor: 'pointer', color: '#dc2626', fontSize: 11, flexShrink: 0 }}
                onClick={() => { const nb = bullets.filter((_, j) => j !== i); setBullets(nb); persist(text, nb); }}>✕</span>
            </li>
          ))}
        </ul>
      )}
      <button className="btn btn-ghost btn-sm" style={{ fontSize: 11, padding: '1px 6px', alignSelf: 'flex-start' }}
        onClick={() => setBullets([...bullets, ''])}>+ bullet</button>
    </div>
  );
}

// ── Deliverables Tab ──────────────────────────────────────
function DeliverablesTab({ sponsors, deliverables, setDeliverables, matrix, setMatrix }) {
  const [addingCol, setAddingCol] = useState(false);
  const [newColName, setNewColName] = useState('');
  const [editingNote, setEditingNote] = useState(null); // { sponsorId, deliverableId }
  const [noteInput, setNoteInput] = useState('');
  const [dragColId, setDragColId] = useState(null);
  const [overColId, setOverColId] = useState(null);

  // Notes is always the last, non-draggable column
  const notesCol = deliverables.find(isNotesCol);
  const cols = deliverables.filter(d => !isNotesCol(d));
  const orderedDeliverables = notesCol ? [...cols, notesCol] : cols;

  const handleColDrop = async (targetId) => {
    if (!dragColId || dragColId === targetId) { setDragColId(null); setOverColId(null); return; }
    const reordered = [...cols];
    const from = reordered.findIndex(c => c.id === dragColId);
    const to = reordered.findIndex(c => c.id === targetId);
    setDragColId(null); setOverColId(null);
    if (from < 0 || to < 0) return;
    const [moved] = reordered.splice(from, 1);
    reordered.splice(to, 0, moved);
    const next = notesCol ? [...reordered, notesCol] : reordered;
    setDeliverables(next);
    try { await api.put('/deliverables/columns/reorder', { order: next.map(c => c.id) }); } catch { /* keep optimistic order */ }
  };

  const handleSaveNotes = async (sponsorId, deliverableId, content) => {
    await api.put(`/deliverables/${sponsorId}/${deliverableId}`, { checked: false, notes: content });
    setMatrix(prev => ({ ...prev, [sponsorId]: { ...prev[sponsorId], [deliverableId]: { checked: false, notes: content } } }));
  };

  const handleCheck = async (sponsorId, deliverableId, checked) => {
    const current = matrix[sponsorId]?.[deliverableId] || { checked: false, notes: [] };
    const r = await api.put(`/deliverables/${sponsorId}/${deliverableId}`, { checked, notes: current.notes });
    setMatrix(prev => ({ ...prev, [sponsorId]: { ...prev[sponsorId], [deliverableId]: { checked, notes: current.notes } } }));
  };

  const handleAddNote = async (sponsorId, deliverableId) => {
    if (!noteInput.trim()) return;
    const current = matrix[sponsorId]?.[deliverableId] || { checked: false, notes: [] };
    const newNotes = [...current.notes, noteInput.trim()];
    await api.put(`/deliverables/${sponsorId}/${deliverableId}`, { checked: current.checked, notes: newNotes });
    setMatrix(prev => ({ ...prev, [sponsorId]: { ...prev[sponsorId], [deliverableId]: { ...current, notes: newNotes } } }));
    setNoteInput(''); setEditingNote(null);
  };

  const handleDeleteNote = async (sponsorId, deliverableId, idx) => {
    const current = matrix[sponsorId]?.[deliverableId] || { checked: false, notes: [] };
    const newNotes = current.notes.filter((_, i) => i !== idx);
    await api.put(`/deliverables/${sponsorId}/${deliverableId}`, { checked: current.checked, notes: newNotes });
    setMatrix(prev => ({ ...prev, [sponsorId]: { ...prev[sponsorId], [deliverableId]: { ...current, notes: newNotes } } }));
  };

  const handleAddCol = async () => {
    if (!newColName.trim()) return;
    const r = await api.post('/deliverables/columns', { name: newColName.trim() });
    setDeliverables(prev => [...prev, r.data]);
    // Init matrix for new column
    setMatrix(prev => {
      const updated = { ...prev };
      sponsors.forEach(s => { updated[s.id] = { ...updated[s.id], [r.data.id]: { checked: false, notes: [] } }; });
      return updated;
    });
    setNewColName(''); setAddingCol(false);
  };

  const handleDeleteCol = async (id) => {
    if (!window.confirm('Delete this column?')) return;
    await api.delete(`/deliverables/columns/${id}`);
    setDeliverables(prev => prev.filter(d => d.id !== id));
  };

  const confirmed = sponsors.filter(s => s.status === 'confirmed');
  const probable = sponsors.filter(s => s.status === 'probable');
  const allSponsors = [...confirmed, ...probable];

  return (
    <div style={{ padding: 24, overflowX: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        {addingCol ? (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input className="form-input" placeholder="Column name" value={newColName}
              onChange={e => setNewColName(e.target.value)} autoFocus
              onKeyDown={e => { if (e.key === 'Enter') handleAddCol(); if (e.key === 'Escape') setAddingCol(false); }}
              style={{ width: 160 }} />
            <button className="btn btn-navy btn-sm" onClick={handleAddCol}>Add</button>
            <button className="btn btn-ghost btn-sm" onClick={() => setAddingCol(false)}>Cancel</button>
          </div>
        ) : (
          <button className="btn btn-navy btn-sm" onClick={() => setAddingCol(true)}>+ Add Column</button>
        )}
      </div>

      <table className="del-table">
        <thead>
          <tr>
            <th style={{ minWidth: 160 }}>Company</th>
            <th style={{ minWidth: 80 }}>Status</th>
            {cols.map(d => (
              <th key={d.id} style={{ minWidth: 120, cursor: 'move', opacity: dragColId === d.id ? 0.4 : 1, outline: overColId === d.id ? '2px dashed rgba(255,255,255,0.7)' : 'none', outlineOffset: -2 }}
                draggable
                onDragStart={() => setDragColId(d.id)}
                onDragOver={e => { e.preventDefault(); if (overColId !== d.id) setOverColId(d.id); }}
                onDragLeave={() => { if (overColId === d.id) setOverColId(null); }}
                onDrop={() => handleColDrop(d.id)}
                onDragEnd={() => { setDragColId(null); setOverColId(null); }}
                title="Drag to reorder column">
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'space-between' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ opacity: 0.5, fontSize: 11, letterSpacing: -2 }}>⋮⋮</span>{d.name}
                  </span>
                  <span style={{ cursor: 'pointer', opacity: 0.6, fontSize: 11 }}
                    onClick={() => handleDeleteCol(d.id)} title="Delete column">✕</span>
                </div>
              </th>
            ))}
            {notesCol && <th key={notesCol.id} style={{ minWidth: 240 }}>{notesCol.name}</th>}
          </tr>
        </thead>
        <tbody>
          {allSponsors.map(sponsor => (
            <tr key={sponsor.id}>
              <td className="company-cell">{sponsor.name}</td>
              <td><span className={`badge badge-${sponsor.status}`}>{sponsor.status}</span></td>
              {orderedDeliverables.map(d => {
                const cell = matrix[sponsor.id]?.[d.id] || { checked: false, notes: [] };
                if (isNotesCol(d)) {
                  return (
                    <td key={d.id} style={{ verticalAlign: 'top' }}>
                      <NotesCell
                        value={cell.notes}
                        onSave={content => handleSaveNotes(sponsor.id, d.id, content)}
                      />
                    </td>
                  );
                }
                const isEditing = editingNote?.sponsorId === sponsor.id && editingNote?.deliverableId === d.id;
                return (
                  <td key={d.id}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {/* Checkbox */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div className={`check-box${cell.checked ? ' checked' : ''}`}
                          onClick={() => handleCheck(sponsor.id, d.id, !cell.checked)}>
                          {cell.checked && <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4l3 3 5-6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                        </div>
                      </div>
                      {/* Notes */}
                      {cell.notes.length > 0 && (
                        <ul className="notes-list">
                          {cell.notes.map((note, i) => (
                            <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 4 }}>
                              <span style={{ flex: 1 }}>{note}</span>
                              <span style={{ cursor: 'pointer', color: '#dc2626', fontSize: 10, flexShrink: 0 }}
                                onClick={() => handleDeleteNote(sponsor.id, d.id, i)}>✕</span>
                            </li>
                          ))}
                        </ul>
                      )}
                      {/* Add note */}
                      {isEditing ? (
                        <div style={{ display: 'flex', gap: 4 }}>
                          <input className="note-input" value={noteInput} onChange={e => setNoteInput(e.target.value)}
                            placeholder="Add note…" autoFocus
                            onKeyDown={e => { if (e.key === 'Enter') handleAddNote(sponsor.id, d.id); if (e.key === 'Escape') setEditingNote(null); }} />
                          <button className="btn btn-navy btn-sm" style={{ padding: '2px 6px' }} onClick={() => handleAddNote(sponsor.id, d.id)}>+</button>
                        </div>
                      ) : (
                        <button className="btn btn-ghost btn-sm" style={{ fontSize: 11, padding: '1px 6px', alignSelf: 'flex-start' }}
                          onClick={() => { setEditingNote({ sponsorId: sponsor.id, deliverableId: d.id }); setNoteInput(''); }}>
                          + note
                        </button>
                      )}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      {allSponsors.length === 0 && (
        <div style={{ textAlign: 'center', color: '#a0aec0', padding: 40 }}>
          No sponsors yet — add them in the Schedule tab
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────
export default function MainPage() {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState('schedule');
  const [sponsors, setSponsors] = useState([]);
  const [schedule, setSchedule] = useState([]);
  const [deliverables, setDeliverables] = useState([]);
  const [matrix, setMatrix] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { navigate('/login'); return; }
    Promise.all([
      api.get('/sponsors'),
      api.get('/schedule'),
      api.get('/deliverables'),
    ]).then(([sp, sc, dl]) => {
      setSponsors(sp.data);
      setSchedule(sc.data);
      setDeliverables(dl.data.deliverables);
      setMatrix(dl.data.matrix);
    }).catch(console.error)
      .finally(() => setLoading(false));
  }, [user]);

  // Sync sponsors changes back to deliverables matrix
  const handleAddSponsor = async (name, status) => {
    const r = await api.post('/sponsors', { name, status });
    setSponsors(prev => [...prev, r.data]);
    setMatrix(prev => {
      const updated = { ...prev, [r.data.id]: {} };
      deliverables.forEach(d => { updated[r.data.id][d.id] = { checked: false, notes: [] }; });
      return updated;
    });
  };

  const handleDeleteSponsor = async (id) => {
    await api.delete(`/sponsors/${id}`);
    setSponsors(prev => prev.filter(s => s.id !== id));
    setMatrix(prev => { const u = { ...prev }; delete u[id]; return u; });
    // Remove from schedule
    setSchedule(prev => prev.map(d => ({
      ...d, slots: d.slots.map(slot => ({
        ...slot, assignments: slot.assignments.filter(a => a.sponsor_id !== id)
      }))
    })));
  };

  const handleStatusChange = async (id, status) => {
    await api.put(`/sponsors/${id}`, { status });
    setSponsors(prev => prev.map(s => s.id === id ? { ...s, status } : s));
  };

  const handleLogout = async () => {
    await api.post('/auth/logout');
    setUser(null);
    navigate('/login');
  };

  if (!user || loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#718096' }}>Loading…</div>
    </div>
  );

  return (
    <div>
      {/* Header */}
      <div className="header">
        <div className="header-title">⭐ AAPI Sponsors 2026</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>{user.name}</span>
          <button className="btn btn-ghost btn-sm" style={{ color: 'rgba(255,255,255,0.8)', border: '1px solid rgba(255,255,255,0.3)' }} onClick={handleLogout}>Log Out</button>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs">
        <div className={`tab${tab === 'schedule' ? ' active' : ''}`} onClick={() => setTab('schedule')}>
          📅 Meeting Schedule
        </div>
        <div className={`tab${tab === 'deliverables' ? ' active' : ''}`} onClick={() => setTab('deliverables')}>
          📋 Deliverables
        </div>
      </div>

      {/* Content */}
      {tab === 'schedule' && (
        <ScheduleTab
          sponsors={sponsors}
          schedule={schedule}
          setSchedule={setSchedule}
          onAddSponsor={handleAddSponsor}
          onDeleteSponsor={handleDeleteSponsor}
          onStatusChange={handleStatusChange}
        />
      )}
      {tab === 'deliverables' && (
        <DeliverablesTab
          sponsors={sponsors}
          deliverables={deliverables}
          setDeliverables={setDeliverables}
          matrix={matrix}
          setMatrix={setMatrix}
        />
      )}
    </div>
  );
}
