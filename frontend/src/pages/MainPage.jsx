import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
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

  const byName = (a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  const confirmed = sponsors.filter(s => s.status === 'confirmed').sort(byName);
  const probable = sponsors.filter(s => s.status === 'probable').sort(byName);

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
function ScheduleTab({ sponsors, schedule, setSchedule, tabId, onAddSponsor, onDeleteSponsor, onStatusChange }) {
  const [dragSponsorId, setDragSponsorId] = useState(null);
  const [dragDayId, setDragDayId] = useState(null);
  const [overDayId, setOverDayId] = useState(null);
  const [addingSlot, setAddingSlot] = useState(null); // dayId
  const [addingDay, setAddingDay] = useState(false);
  const [newDayName, setNewDayName] = useState('');
  const [newStart, setNewStart] = useState('');
  const [newEnd, setNewEnd] = useState('');
  const [slotError, setSlotError] = useState('');

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
    let start = newStart.trim();
    let end = newEnd.trim();
    // If the whole range was typed into the Start box (e.g. "12:00 PM - 1:00 PM"), split it
    if (start && !end) {
      const parts = start.split(/\s*(?:–|—|-|\bto\b)\s*/i);
      if (parts.length === 2 && parts[0] && parts[1]) { start = parts[0].trim(); end = parts[1].trim(); }
    }
    if (!start || !end) { setSlotError('Enter both a start and end time'); return; }
    const r = await api.post(`/schedule/days/${dayId}/slots`, { start_time: start, end_time: end });
    setSchedule(prev => prev.map(d => d.id === dayId ? { ...d, slots: [...d.slots, r.data] } : d));
    setNewStart(''); setNewEnd(''); setSlotError(''); setAddingSlot(null);
  };

  const handleAddDay = async () => {
    if (!newDayName.trim()) return;
    const r = await api.post('/schedule/days', { name: newDayName.trim(), tab_id: tabId });
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

  const handleDayDrop = async (targetId) => {
    if (!dragDayId || dragDayId === targetId) { setDragDayId(null); setOverDayId(null); return; }
    const ids = schedule.map(d => d.id);
    const from = ids.indexOf(dragDayId), to = ids.indexOf(targetId);
    setDragDayId(null); setOverDayId(null);
    if (from < 0 || to < 0) return;
    const reordered = [...schedule];
    const [moved] = reordered.splice(from, 1);
    reordered.splice(to, 0, moved);
    setSchedule(reordered);
    try { await api.post('/schedule/days/reorder', { order: reordered.map(d => d.id) }); } catch { /* keep optimistic order */ }
  };

  return (
    <div className="boardscroll" style={{ display: 'flex', gap: 20, padding: 24, alignItems: 'flex-start' }}>
      {/* Sponsors sidebar */}
      <SponsorsPanel
        sponsors={sponsors}
        onAdd={onAddSponsor}
        onDelete={onDeleteSponsor}
        onStatusChange={onStatusChange}
        onDragStart={setDragSponsorId}
      />

      {/* Day columns */}
      {schedule.map(day => (
        <div key={day.id} className="day-col" style={{ opacity: dragDayId === day.id ? 0.4 : 1, outline: overDayId === day.id ? '2px dashed #1e3a5f' : 'none', outlineOffset: 2 }}>
          <div className="day-header"
            draggable
            onDragStart={() => setDragDayId(day.id)}
            onDragOver={e => { if (dragDayId) { e.preventDefault(); if (overDayId !== day.id) setOverDayId(day.id); } }}
            onDrop={() => handleDayDrop(day.id)}
            onDragEnd={() => { setDragDayId(null); setOverDayId(null); }}
            style={{ cursor: 'move' }}
            title="Drag to reorder day">
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ opacity: 0.5, fontSize: 12, letterSpacing: -2 }}>⋮⋮</span>{day.name}
            </span>
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
                <input className="form-input" placeholder="Start (e.g. 7:30 AM)" value={newStart}
                  onChange={e => { setNewStart(e.target.value); if (slotError) setSlotError(''); }}
                  onKeyDown={e => { if (e.key === 'Enter') handleAddSlot(day.id); if (e.key === 'Escape') { setAddingSlot(null); setSlotError(''); } }}
                  style={{ flex: 1 }} />
                <input className="form-input" placeholder="End (e.g. 8:15 AM)" value={newEnd}
                  onChange={e => { setNewEnd(e.target.value); if (slotError) setSlotError(''); }}
                  onKeyDown={e => { if (e.key === 'Enter') handleAddSlot(day.id); if (e.key === 'Escape') { setAddingSlot(null); setSlotError(''); } }}
                  style={{ flex: 1 }} />
              </div>
              {slotError && <div style={{ color: '#dc2626', fontSize: 12, marginBottom: 6 }}>{slotError}</div>}
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="btn btn-navy btn-sm" onClick={() => handleAddSlot(day.id)}>Add</button>
                <button className="btn btn-ghost btn-sm" onClick={() => { setAddingSlot(null); setSlotError(''); }}>Cancel</button>
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

// Notes content -> a single block of paragraph text. Bullets are just lines that start with "• ".
// Migrates legacy shapes: plain string, array of strings, or { text, bullets } from earlier builds.
const BULLET = '• ';
function normalizeNotesText(raw) {
  if (typeof raw === 'string') return raw;
  if (Array.isArray(raw)) return raw.map(x => BULLET + x).join('\n');
  if (raw && typeof raw === 'object') {
    const parts = [];
    if (raw.text) parts.push(raw.text);
    if (Array.isArray(raw.bullets)) parts.push(...raw.bullets.map(b => BULLET + b));
    return parts.join('\n');
  }
  return '';
}

// Single notes box (pinned last column). "+ bullet" inserts a bullet line into the text itself.
function NotesCell({ value, onSave }) {
  const [text, setText] = useState(normalizeNotesText(value));
  const ref = useRef(null);
  const firstRun = useRef(true);

  // Debounced auto-save so entries persist between background refreshes (not only on blur)
  useEffect(() => {
    if (firstRun.current) { firstRun.current = false; return; }
    const id = setTimeout(() => onSave(text), 1200);
    return () => clearTimeout(id);
  }, [text]);

  const addBullet = () => {
    const ta = ref.current;
    const pos = ta ? (ta.selectionStart ?? text.length) : text.length;
    const before = text.slice(0, pos);
    const after = text.slice(pos);
    const prefix = (before === '' || before.endsWith('\n')) ? BULLET : '\n' + BULLET;
    const next = before + prefix + after;
    setText(next);
    const caret = before.length + prefix.length;
    requestAnimationFrame(() => { if (ta) { ta.focus(); ta.setSelectionRange(caret, caret); } });
  };

  const handleKeyDown = e => {
    if (e.key !== 'Enter') return;
    const ta = ref.current;
    const pos = ta ? ta.selectionStart : text.length;
    const lineStart = text.lastIndexOf('\n', pos - 1) + 1;
    const line = text.slice(lineStart, pos);
    // Continue a bullet list when Enter is pressed on a bullet line
    if (line.trimStart().startsWith('•')) {
      if (line.trim() === '•') return; // empty bullet -> let Enter break out
      e.preventDefault();
      const before = text.slice(0, pos);
      const after = text.slice(pos);
      const next = before + '\n' + BULLET + after;
      setText(next);
      const caret = before.length + 1 + BULLET.length;
      requestAnimationFrame(() => { if (ta) { ta.focus(); ta.setSelectionRange(caret, caret); } });
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 220 }}>
      <textarea
        ref={ref}
        className="note-input"
        style={{ width: '100%', minHeight: 70, resize: 'vertical', fontFamily: 'inherit', padding: '6px 8px', lineHeight: 1.5 }}
        placeholder="Add notes…"
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => onSave(text)}
      />
      <button className="btn btn-ghost btn-sm" style={{ fontSize: 11, padding: '1px 6px', alignSelf: 'flex-start' }}
        onClick={addBullet}>+ bullet</button>
    </div>
  );
}

// Compare two cell values for sorting. money=true sorts numerically; empties always sort last.
function cmpVals(a, b, money) {
  const ae = a === '' || a === null || a === undefined;
  const be = b === '' || b === null || b === undefined;
  if (ae && be) return 0;
  if (ae) return 1;
  if (be) return -1;
  if (money) {
    const na = Number(String(a).replace(/[^0-9.-]/g, ''));
    const nb = Number(String(b).replace(/[^0-9.-]/g, ''));
    if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
  }
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
}

// Arrow shown on the active sort header
const sortArrow = (active, dir) => active ? (dir === 1 ? ' ▲' : ' ▼') : '';

// Format a numeric string as USD currency (strips $ and commas; leaves true non-numbers untouched)
function formatCurrency(v) {
  if (v === '' || v === null || v === undefined) return '';
  const n = Number(String(v).replace(/[^0-9.-]/g, ''));
  if (Number.isNaN(n)) return String(v);
  return n.toLocaleString(undefined, { style: 'currency', currency: 'USD' });
}

// A text / number / currency cell. Currency shows formatted, edits as a raw number.
function TypedCell({ type, value, onSave }) {
  const [val, setVal] = useState(value ?? '');
  const [editing, setEditing] = useState(false);
  const firstRun = useRef(true);
  const commit = () => { setEditing(false); if (val !== (value ?? '')) onSave(val); };

  // Debounced auto-save so entries persist between background refreshes
  useEffect(() => {
    if (firstRun.current) { firstRun.current = false; return; }
    const id = setTimeout(() => { if (val !== (value ?? '')) onSave(val); }, 1200);
    return () => clearTimeout(id);
  }, [val]);

  if (type === 'currency') {
    return editing ? (
      <input type="number" step="0.01" className="note-input" autoFocus
        style={{ width: '100%', padding: '4px 6px' }}
        value={val} onChange={e => setVal(e.target.value)} onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setVal(value ?? ''); setEditing(false); } }} />
    ) : (
      <div onClick={() => setEditing(true)}
        style={{ cursor: 'text', minHeight: 26, padding: '4px 6px', color: val === '' ? '#a0aec0' : '#1a202c' }}>
        {val === '' ? '—' : formatCurrency(val)}
      </div>
    );
  }
  return (
    <input type={type === 'number' ? 'number' : 'text'} className="note-input"
      style={{ width: '100%', padding: '4px 6px' }}
      value={val} placeholder="—"
      onChange={e => setVal(e.target.value)}
      onBlur={() => { if (val !== (value ?? '')) onSave(val); }} />
  );
}

// ── Deliverables Tab ──────────────────────────────────────
function DeliverablesTab({ sponsors, deliverables, setDeliverables, matrix, setMatrix, tabId }) {
  const [addingCol, setAddingCol] = useState(false);
  const [newColName, setNewColName] = useState('');
  const [newColType, setNewColType] = useState('checkbox');
  const [editingNote, setEditingNote] = useState(null); // { sponsorId, deliverableId }
  const [noteInput, setNoteInput] = useState('');
  const [dragColId, setDragColId] = useState(null);
  const [overColId, setOverColId] = useState(null);
  const [editingColId, setEditingColId] = useState(null);
  const [editColName, setEditColName] = useState('');
  const [sort, setSort] = useState({ key: null, dir: 1 }); // key: 'company' | 'status' | deliverable id
  const toggleSort = key => setSort(s => s.key === key ? { key, dir: -s.dir } : { key, dir: 1 });

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

  // Merge one field into a matrix cell, keeping the rest intact
  const patchCell = (sponsorId, deliverableId, patch) =>
    setMatrix(prev => {
      const cur = prev[sponsorId]?.[deliverableId] || { checked: false, notes: [], value: '' };
      return { ...prev, [sponsorId]: { ...prev[sponsorId], [deliverableId]: { ...cur, ...patch } } };
    });

  const handleSaveNotes = async (sponsorId, deliverableId, content) => {
    await api.put(`/deliverables/${sponsorId}/${deliverableId}`, { notes: content });
    patchCell(sponsorId, deliverableId, { notes: content });
  };

  const handleSaveValue = async (sponsorId, deliverableId, value) => {
    await api.put(`/deliverables/${sponsorId}/${deliverableId}`, { value });
    patchCell(sponsorId, deliverableId, { value });
  };

  const handleCheck = async (sponsorId, deliverableId, checked) => {
    await api.put(`/deliverables/${sponsorId}/${deliverableId}`, { checked });
    patchCell(sponsorId, deliverableId, { checked });
  };

  const handleAddNote = async (sponsorId, deliverableId) => {
    if (!noteInput.trim()) return;
    const current = matrix[sponsorId]?.[deliverableId] || { checked: false, notes: [], value: '' };
    const newNotes = [...(Array.isArray(current.notes) ? current.notes : []), noteInput.trim()];
    await api.put(`/deliverables/${sponsorId}/${deliverableId}`, { notes: newNotes });
    patchCell(sponsorId, deliverableId, { notes: newNotes });
    setNoteInput(''); setEditingNote(null);
  };

  const handleDeleteNote = async (sponsorId, deliverableId, idx) => {
    const current = matrix[sponsorId]?.[deliverableId] || { checked: false, notes: [], value: '' };
    const newNotes = (Array.isArray(current.notes) ? current.notes : []).filter((_, i) => i !== idx);
    await api.put(`/deliverables/${sponsorId}/${deliverableId}`, { notes: newNotes });
    patchCell(sponsorId, deliverableId, { notes: newNotes });
  };

  const handleAddCol = async () => {
    if (!newColName.trim()) return;
    const r = await api.post('/deliverables/columns', { name: newColName.trim(), col_type: newColType, tab_id: tabId });
    setDeliverables(prev => [...prev, r.data]);
    setMatrix(prev => {
      const updated = { ...prev };
      sponsors.forEach(s => { updated[s.id] = { ...updated[s.id], [r.data.id]: { checked: false, notes: [], value: '' } }; });
      return updated;
    });
    setNewColName(''); setNewColType('checkbox'); setAddingCol(false);
  };

  const handleRenameCol = async (id, name) => {
    setEditingColId(null);
    if (!name.trim()) return;
    await api.put(`/deliverables/columns/${id}`, { name: name.trim() });
    setDeliverables(prev => prev.map(d => d.id === id ? { ...d, name: name.trim() } : d));
  };

  const handleColType = async (id, col_type) => {
    await api.put(`/deliverables/columns/${id}`, { col_type });
    setDeliverables(prev => prev.map(d => d.id === id ? { ...d, col_type } : d));
  };

  const handleDeleteCol = async (id) => {
    if (!window.confirm('Delete this column?')) return;
    await api.delete(`/deliverables/columns/${id}`);
    setDeliverables(prev => prev.filter(d => d.id !== id));
  };

  const byName = (a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  const confirmed = sponsors.filter(s => s.status === 'confirmed').sort(byName);
  const probable = sponsors.filter(s => s.status === 'probable').sort(byName);

  // Default order = Confirmed (A–Z) then Probable (A–Z); a header click overrides it
  let allSponsors = [...confirmed, ...probable];
  if (sort.key) {
    const col = (sort.key !== 'company' && sort.key !== 'status') ? deliverables.find(d => d.id === sort.key) : null;
    const valueOf = (s) => {
      if (sort.key === 'company') return s.name;
      if (sort.key === 'status') return s.status;
      const cell = matrix[s.id]?.[sort.key] || {};
      if (col && isNotesCol(col)) {
        const n = cell.notes;
        return typeof n === 'string' ? n : Array.isArray(n) ? n.join(' ') : (n?.text || '');
      }
      if (col && col.col_type && col.col_type !== 'checkbox') return cell.value;
      return cell.checked ? 1 : 0; // checkbox columns: checked first
    };
    const money = !!(col && (col.col_type === 'currency' || col.col_type === 'number'));
    allSponsors = [...sponsors].sort((a, b) => cmpVals(valueOf(a), valueOf(b), money) * sort.dir);
  }

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        {addingCol ? (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input className="form-input" placeholder="Column name" value={newColName}
              onChange={e => setNewColName(e.target.value)} autoFocus
              onKeyDown={e => { if (e.key === 'Enter') handleAddCol(); if (e.key === 'Escape') setAddingCol(false); }}
              style={{ width: 160 }} />
            <select value={newColType} onChange={e => setNewColType(e.target.value)}
              style={{ padding: '7px 8px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 13, fontFamily: 'inherit' }}>
              <option value="checkbox">☑ Checkbox</option>
              <option value="text">🔤 Text</option>
              <option value="number">🔢 Number</option>
              <option value="currency">💲 Currency</option>
            </select>
            <button className="btn btn-navy btn-sm" onClick={handleAddCol}>Add</button>
            <button className="btn btn-ghost btn-sm" onClick={() => setAddingCol(false)}>Cancel</button>
          </div>
        ) : (
          <button className="btn btn-navy btn-sm" onClick={() => setAddingCol(true)}>+ Add Column</button>
        )}
      </div>

      <div className="tablewrap">
      <table className="del-table">
        <thead>
          <tr>
            <th style={{ minWidth: 160, cursor: 'pointer', userSelect: 'none' }} onClick={() => toggleSort('company')} title="Click to sort">
              Company{sortArrow(sort.key === 'company', sort.dir)}
            </th>
            <th style={{ minWidth: 80, cursor: 'pointer', userSelect: 'none' }} onClick={() => toggleSort('status')} title="Click to sort">
              Status{sortArrow(sort.key === 'status', sort.dir)}
            </th>
            {cols.map(d => (
              <th key={d.id} style={{ minWidth: 130, cursor: editingColId === d.id ? 'default' : 'move', opacity: dragColId === d.id ? 0.4 : 1, outline: overColId === d.id ? '2px dashed rgba(255,255,255,0.7)' : 'none', outlineOffset: -2 }}
                draggable={editingColId !== d.id}
                onDragStart={() => setDragColId(d.id)}
                onDragOver={e => { e.preventDefault(); if (overColId !== d.id) setOverColId(d.id); }}
                onDragLeave={() => { if (overColId === d.id) setOverColId(null); }}
                onDrop={() => handleColDrop(d.id)}
                onDragEnd={() => { setDragColId(null); setOverColId(null); }}
                title="Drag to reorder · double-click name to rename">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'space-between' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1, minWidth: 0 }}>
                      <span style={{ opacity: 0.5, fontSize: 11, letterSpacing: -2 }}>⋮⋮</span>
                      {editingColId === d.id ? (
                        <input autoFocus value={editColName}
                          onChange={e => setEditColName(e.target.value)}
                          onClick={e => e.stopPropagation()}
                          onBlur={() => handleRenameCol(d.id, editColName)}
                          onKeyDown={e => { if (e.key === 'Enter') handleRenameCol(d.id, editColName); if (e.key === 'Escape') setEditingColId(null); }}
                          style={{ font: 'inherit', width: 110, padding: '2px 4px', color: '#1a202c', borderRadius: 4, border: 'none' }} />
                      ) : (
                        <span onDoubleClick={() => { setEditingColId(d.id); setEditColName(d.name); }}
                          style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</span>
                      )}
                    </span>
                    <span style={{ cursor: 'pointer', opacity: sort.key === d.id ? 1 : 0.55, fontSize: 11 }}
                      onClick={e => { e.stopPropagation(); toggleSort(d.id); }} title="Sort by this column">
                      {sort.key === d.id ? (sort.dir === 1 ? '▲' : '▼') : '↕'}
                    </span>
                    <span style={{ cursor: 'pointer', opacity: 0.6, fontSize: 11 }}
                      onClick={() => handleDeleteCol(d.id)} title="Delete column">✕</span>
                  </div>
                  <select value={d.col_type || 'checkbox'} onClick={e => e.stopPropagation()}
                    onChange={e => handleColType(d.id, e.target.value)}
                    title="Column type"
                    style={{ fontSize: 11, padding: '1px 2px', borderRadius: 4, border: 'none', color: '#1a202c', fontFamily: 'inherit', cursor: 'pointer' }}>
                    <option value="checkbox">☑ Checkbox</option>
                    <option value="text">🔤 Text</option>
                    <option value="number">🔢 Number</option>
                    <option value="currency">💲 Currency</option>
                  </select>
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
                const cell = matrix[sponsor.id]?.[d.id] || { checked: false, notes: [], value: '' };
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
                const colType = d.col_type || 'checkbox';
                if (colType !== 'checkbox') {
                  return (
                    <td key={d.id} style={{ verticalAlign: 'top' }}>
                      <TypedCell
                        type={colType}
                        value={cell.value}
                        onSave={v => handleSaveValue(sponsor.id, d.id, v)}
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
      </div>

      {allSponsors.length === 0 && (
        <div style={{ textAlign: 'center', color: '#a0aec0', padding: 40 }}>
          No sponsors yet — add them in the Schedule tab
        </div>
      )}
    </div>
  );
}

// ── Table tabs (Exhibits, Sponsors): fixed columns, zebra rows, Excel import ──
const EXHIBIT_COLS = [
  { key: 'booth', label: 'Booth #', w: 64, aliases: ['booth', 'booth#', 'boothnumber', 'boothno'] },
  { key: 'company', label: 'Company Name', w: 150, aliases: ['companyname', 'company', 'exhibitor', 'exhibitorname'] },
  { key: 'price', label: 'Price', w: 92, money: true, aliases: ['price', 'amount', 'cost', 'fee'] },
  { key: 'paid', label: 'Paid', w: 92, money: true, aliases: ['paid', 'payment', 'amountpaid'] },
  { key: 'size', label: 'Size', w: 72, aliases: ['size', 'boothsize'] },
  { key: 'contact', label: 'Contact name', w: 130, aliases: ['pcontactname', 'contactname', 'contact', 'primarycontact', 'poc'] },
  { key: 'cell', label: 'Cell', w: 110, aliases: ['cell', 'cellphone', 'phone', 'mobile', 'phonenumber'] },
  { key: 'email', label: 'Email', w: 170, aliases: ['email', 'emailaddress', 'mail'] },
  { key: 'remarks', label: 'Remarks', w: 180, aliases: ['remarks', 'notes', 'comments', 'comment'] },
  { key: 'status', label: 'Confirmed/Pending', w: 124, status: true, aliases: ['confirmedpending', 'status', 'confirmed', 'pending', 'confirmation'] },
];
const SPONSOR_COLS = [
  { key: 'company', label: 'Company', w: 160, aliases: ['company', 'companyname', 'sponsor', 'sponsorname'] },
  { key: 'contact', label: 'Company Contact', w: 150, aliases: ['companycontact', 'contact', 'contactname', 'contactperson'] },
  { key: 'phone', label: 'Phone #', w: 120, aliases: ['phone', 'phone#', 'phonenumber', 'cell', 'mobile'] },
  { key: 'email', label: 'Email', w: 180, aliases: ['email', 'emailaddress', 'mail'] },
  { key: 'amount', label: 'Sponsorship Amt ($)', w: 140, money: true, aliases: ['sponsorshipamt', 'sponsorshipamount', 'sponsorship', 'amount', 'amt', 'pledged'] },
  { key: 'received', label: 'Amount Received ($)', w: 140, money: true, aliases: ['amountreceived', 'received', 'paid', 'amtreceived'] },
  { key: 'status', label: 'Confirmed/Pending', w: 124, status: true, aliases: ['confirmedpending', 'status', 'confirmed', 'pending', 'confirmation'] },
  { key: 'aapi', label: 'AAPI Contact Person', w: 160, aliases: ['aapicontactperson', 'aapicontact', 'aapi', 'aapiperson', 'assignedto'] },
  { key: 'notes', label: 'Notes', w: 200, aliases: ['notes', 'remarks', 'comments', 'comment'] },
];
export const SOUVENIR_COLS = [
  { key: 'company', label: 'Company', w: 160, aliases: ['company', 'companyname', 'advertiser', 'sponsor', 'name'] },
  { key: 'phone', label: 'Phone #', w: 120, aliases: ['phone', 'phone#', 'phonenumber', 'cell', 'mobile'] },
  { key: 'email', label: 'EMAIL', w: 180, aliases: ['email', 'emailaddress', 'mail'] },
  { key: 'adsize', label: 'Ad Size', w: 120, options: ['Full Page', 'Half Page', 'Quarter Page'], aliases: ['adsize', 'size', 'ad', 'page'] },
  { key: 'amount', label: 'Amt ($)', w: 120, money: true, aliases: ['amt', 'amount', 'amt$', 'sponsorshipamt', 'price', 'cost', 'fee'] },
  { key: 'paid', label: 'Paid ($)', w: 120, money: true, aliases: ['paid', 'paid$', 'amountpaid', 'amtpaid'] },
  { key: 'adreceived', label: 'Ad Received', w: 110, options: ['Yes', 'No'], aliases: ['adreceived', 'adrcvd', 'received', 'adstatus'] },
];
export const TOC_COLS = [
  { key: 'sno', label: 'Sno', w: 60, aliases: ['sno', 'sno.', 'slno', 'sl', 'serial', 'no', '#'] },
  { key: 'page', label: 'Page', w: 220, aliases: ['page', 'pagename', 'title', 'item'] },
  { key: 'type', label: 'Type', w: 150, aliases: ['type', 'category'] },
  { key: 'received', label: 'Received?', w: 110, options: ['Yes', 'No'], aliases: ['received', 'recevied', 'recd', 'received?'] },
  { key: 'remarks', label: 'Remarks', w: 220, aliases: ['remarks', 'notes', 'comments', 'comment'] },
];
export const VIPADS_COLS = [
  { key: 'sno', label: 'Sno', w: 60, aliases: ['sno', 'sno.', 'slno', 'sl', 'serial', 'no', '#'] },
  { key: 'package', label: 'Package', w: 120, aliases: ['package', 'pkg', 'level', 'tier'] },
  { key: 'name', label: 'Name (Dr.)', w: 190, aliases: ['namedr', 'name', 'drname', 'doctor', 'physician', 'name(dr.)'] },
  { key: 'adsize', label: 'AD Size', w: 110, options: ['Full', 'Half', 'Quarter'], aliases: ['adsize', 'size', 'ad'] },
  { key: 'responded', label: 'Client Sent Ad?', w: 130, options: ['Yes', 'No'], aliases: ['clientsentad', 'clientsent', 'sentad', 'adsent', 'responded', 'response'] },
  { key: 'created', label: 'Created Ad?', w: 120, options: ['Yes', 'No'], aliases: ['createdad', 'created', 'created?', 'done', 'ready'] },
  { key: 'remarks', label: 'Remarks', w: 200, aliases: ['remarks', 'notes', 'comments', 'comment'] },
];
const TABLE_COLS = { exhibits: EXHIBIT_COLS, sponsorlist: SPONSOR_COLS, souvenir: SOUVENIR_COLS, toc: TOC_COLS, vipads: VIPADS_COLS };
export { TABLE_COLS };
const isTableType = t => ['exhibits', 'sponsorlist', 'souvenir', 'toc', 'vipads'].includes(t);
const isSouvenirFamily = t => ['souvenir', 'toc', 'vipads'].includes(t);
const normHeader = s => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');

// Map one parsed spreadsheet row (keyed by its headers) to our column keys
function mapExcelRow(raw, cols) {
  const entries = Object.entries(raw);
  const out = {};
  for (const col of cols) {
    const aliases = col.aliases || [normHeader(col.label)];
    let found = entries.find(([h]) => aliases.includes(normHeader(h)));
    if (!found) found = entries.find(([h]) => aliases.some(a => normHeader(h).includes(a)));
    out[col.key] = found ? String(found[1] ?? '').trim() : '';
  }
  return out;
}

export function TableTab({ rows, setRows, tabId, cols, noun = 'row', title = 'table', onSync, apiBase = '/exhibits', strikeDelete = false }) {
  const fileRef = useRef(null);
  const [importing, setImporting] = useState(false);
  const [sort, setSort] = useState({ key: null, dir: 1 });

  const toggleSort = key => setSort(s => s.key === key ? { key, dir: -s.dir } : { key, dir: 1 });
  const displayRows = sort.key
    ? [...rows].sort((a, b) => cmpVals(a.data?.[sort.key], b.data?.[sort.key], cols.find(c => c.key === sort.key)?.money) * sort.dir)
    : rows;

  const addRow = async () => {
    const r = await api.post(apiBase, { tab_id: tabId, data: {} });
    setRows(prev => [...prev, r.data]);
  };

  const exportFile = () => {
    const data = rows.map(r => {
      const o = {};
      for (const c of cols) {
        const raw = r.data?.[c.key] ?? '';
        if (c.money) {
          const n = Number(String(raw).replace(/[^0-9.-]/g, ''));
          o[c.label] = (raw === '' || Number.isNaN(n)) ? '' : n; // real number; non-numeric -> blank
        } else {
          o[c.label] = raw;
        }
      }
      return o;
    });
    const ws = XLSX.utils.json_to_sheet(data, { header: cols.map(c => c.label) });
    // Give money columns a currency number format so Excel shows $ and SUM totals them
    const range = XLSX.utils.decode_range(ws['!ref']);
    cols.forEach((c, ci) => {
      if (!c.money) return;
      for (let R = 1; R <= range.e.r; R++) {
        const cell = ws[XLSX.utils.encode_cell({ r: R, c: ci })];
        if (cell && cell.t === 'n') cell.z = '$#,##0.00';
      }
    });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    // Build a real Blob and download via an anchor (reliable after the async import)
    const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const safe = String(title).replace(/[^a-z0-9_-]+/gi, '_') || 'table';
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${safe}.xlsx`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 1000);
  };

  const saveCell = async (rowId, key, value) => {
    const row = rows.find(x => x.id === rowId);
    const data = { ...(row?.data || {}), [key]: value };
    setRows(prev => prev.map(x => x.id === rowId ? { ...x, data } : x));
    try { await api.put(`${apiBase}/${rowId}`, { data }); } catch { /* keep optimistic value */ }
  };

  const deleteRow = async (rowId) => {
    if (strikeDelete) {
      // Don't remove — toggle strike-through (kept visible)
      const row = rows.find(x => x.id === rowId);
      const next = !row?.struck;
      setRows(prev => prev.map(x => x.id === rowId ? { ...x, struck: next } : x));
      try { await api.put(`${apiBase}/${rowId}`, { struck: next }); } catch {}
      return;
    }
    if (!window.confirm('Delete this row?')) return;
    setRows(prev => prev.filter(x => x.id !== rowId));
    try { await api.delete(`${apiBase}/${rowId}`); } catch {}
  };

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      // Pick the sheet: auto-match by tab name, else ask which one
      let sheetName = wb.SheetNames[0];
      if (wb.SheetNames.length > 1) {
        const norm = s => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');
        const match = wb.SheetNames.find(n => norm(n) === norm(title));
        if (match) {
          sheetName = match;
        } else {
          const choice = window.prompt(
            `This file has ${wb.SheetNames.length} sheets:\n` +
            wb.SheetNames.map((n, i) => `${i + 1}. ${n}`).join('\n') +
            `\n\nEnter the number of the sheet to import into "${title}":`, '1');
          if (choice === null) return;
          const idx = parseInt(choice, 10) - 1;
          if (Number.isNaN(idx) || idx < 0 || idx >= wb.SheetNames.length) { alert('Invalid sheet number.'); return; }
          sheetName = wb.SheetNames[idx];
        }
      }
      const sheet = wb.Sheets[sheetName];
      const json = XLSX.utils.sheet_to_json(sheet, { defval: '' });
      const mapped = json.map(r => mapExcelRow(r, cols)).filter(d => Object.values(d).some(v => String(v).trim() !== ''));
      if (!mapped.length) { alert('No data rows found. Make sure the first row has column headers.'); return; }
      let replace = false;
      if (rows.length > 0) {
        replace = window.confirm(
          `This tab already has ${rows.length} row${rows.length === 1 ? '' : 's'}.\n\n` +
          `OK  = REPLACE them with the ${mapped.length} imported row${mapped.length === 1 ? '' : 's'}\n` +
          `Cancel = ADD the imported rows to the existing ones`
        );
      }
      const res = await api.post(`${apiBase}/bulk`, { tab_id: tabId, rows: mapped, replace });
      setRows(prev => replace ? res.data : [...prev, ...res.data]);
      alert(`${replace ? 'Replaced with' : 'Imported'} ${res.data.length} row${res.data.length === 1 ? '' : 's'}.`);
    } catch (err) {
      alert('Could not read that file. Please upload a .xlsx or .csv with column headers in the first row.');
    } finally {
      setImporting(false);
      e.target.value = '';
    }
  };

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 16 }}>
        <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }} onChange={onFile} />
        {onSync && (
          <button className="btn btn-ghost btn-sm" disabled={!rows.length} onClick={() => onSync(rows)}
            title="Add these companies to the shared sponsor pool used by Deliverables & Product Theatre">
            🔗 Sync to Deliverables
          </button>
        )}
        <button className="btn btn-ghost btn-sm" disabled={!rows.length} onClick={exportFile} title="Download as Excel">
          ⬇ Download Excel
        </button>
        <button className="btn btn-ghost btn-sm" disabled={importing} onClick={() => fileRef.current?.click()}>
          {importing ? 'Importing…' : '⬆ Upload Excel/CSV'}
        </button>
        <button className="btn btn-navy btn-sm" onClick={addRow}>+ Add Row</button>
      </div>

      <div className="tablewrap">
      <table className="del-table" style={{ width: 'auto' }}>
        <thead>
          <tr>
            {cols.map(c => (
              <th key={c.key} onClick={() => toggleSort(c.key)} title="Click to sort"
                style={{ minWidth: c.w, whiteSpace: 'nowrap', cursor: 'pointer', userSelect: 'none' }}>
                {c.label}{sortArrow(sort.key === c.key, sort.dir)}
              </th>
            ))}
            <th style={{ width: 36 }}></th>
          </tr>
        </thead>
        <tbody>
          {displayRows.map((row, i) => (
            <tr key={row.id} style={{ background: i % 2 === 0 ? '#ffffff' : '#f1f5f9',
              textDecoration: row.struck ? 'line-through' : 'none',
              opacity: row.struck ? 0.55 : 1 }}>
              {cols.map(c => (
                <td key={c.key} style={{ padding: 2 }}>
                  {(c.options || c.status) ? (() => {
                    const opts = c.options || ['Confirmed', 'Pending'];
                    const cur = row.data?.[c.key] || '';
                    const list = cur && !opts.includes(cur) ? [cur, ...opts] : opts; // keep unrecognized imported values
                    return (
                      <select className="note-input" style={{ width: '100%', padding: '4px 6px', background: 'transparent' }}
                        value={cur} onChange={e => saveCell(row.id, c.key, e.target.value)}>
                        <option value="">—</option>
                        {list.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    );
                  })() : (
                    <ExhibitCell value={row.data?.[c.key] || ''} money={c.money} onSave={v => saveCell(row.id, c.key, v)} />
                  )}
                </td>
              ))}
              <td style={{ textAlign: 'center' }}>
                <span style={{ cursor: 'pointer', color: row.struck ? '#059669' : '#dc2626', fontSize: 12 }}
                  title={strikeDelete ? (row.struck ? 'Restore (un-strike)' : 'Strike out (keeps the row)') : 'Delete row'}
                  onClick={() => deleteRow(row.id)}>{strikeDelete ? (row.struck ? '↺' : '⊘') : '✕'}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>

      {rows.length === 0 && (
        <div style={{ textAlign: 'center', color: '#a0aec0', padding: 40 }}>
          No {noun}s yet — click “+ Add Row”, or “Upload Excel/CSV” to import a list.
        </div>
      )}
    </div>
  );
}

// One editable exhibit cell (keeps local state so background refresh won't clobber typing)
function ExhibitCell({ value, onSave, money }) {
  const [val, setVal] = useState(value ?? '');
  const [editing, setEditing] = useState(false);
  // Auto-size to content (in chars) so columns fit their values
  const size = Math.min(48, Math.max(8, String(val ?? '').length + 1));
  const inputStyle = { width: 'auto', padding: '4px 6px', background: 'transparent' };

  if (money) {
    const commit = () => { setEditing(false); if (val !== (value ?? '')) onSave(val); };
    return editing ? (
      <input className="note-input" autoFocus inputMode="decimal" size={size}
        style={{ ...inputStyle, textAlign: 'right' }}
        value={val} placeholder="$"
        onChange={e => setVal(e.target.value)} onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setVal(value ?? ''); setEditing(false); } }} />
    ) : (
      <div onClick={() => setEditing(true)}
        style={{ cursor: 'text', minHeight: 26, padding: '4px 6px', textAlign: 'right', whiteSpace: 'nowrap', color: val === '' ? '#a0aec0' : '#1a202c' }}>
        {val === '' ? '—' : formatCurrency(val)}
      </div>
    );
  }
  return (
    <input className="note-input" size={size} style={inputStyle}
      value={val} placeholder="—"
      onChange={e => setVal(e.target.value)}
      onBlur={() => { if (val !== (value ?? '')) onSave(val); }} />
  );
}

// ── Tab Bar (add / rename / delete / reorder tabs) ────────
const TAB_ICON = t => t.type === 'deliverables' ? '📋' : t.type === 'exhibits' ? '🏢' : t.type === 'sponsorlist' ? '🤝' : t.type === 'souvenir' ? '🎁' : t.type === 'toc' ? '📑' : t.type === 'vipads' ? '⭐' : '📅';
const TAB_UNIT = t => t.type === 'schedule' ? 'day' : t.type === 'deliverables' ? 'column' : 'row';

function TabBar({ tabs, activeTabId, onSelect, onAdd, onRename, onDelete, onReorder, trash = [], onRestore, onPurge }) {
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState('schedule');
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [dragId, setDragId] = useState(null);
  const [overId, setOverId] = useState(null);
  const [showTrash, setShowTrash] = useState(false);

  const confirmDelete = (t) => {
    const n = Number(t.item_count || 0);
    const unit = TAB_UNIT(t);
    return window.confirm(
      `Move "${t.name}" to Trash?\n\n` +
      `It contains ${n} ${unit}${n === 1 ? '' : 's'}.\n` +
      `You can restore it from Trash for 30 days.`
    );
  };

  const submitAdd = () => {
    if (!newName.trim()) return;
    onAdd(newName.trim(), newType);
    setNewName(''); setNewType('schedule'); setAdding(false);
  };
  const submitRename = (id) => {
    if (editName.trim()) onRename(id, editName.trim());
    setEditingId(null);
  };
  const drop = (targetId) => {
    if (dragId && dragId !== targetId) {
      const ids = tabs.map(t => t.id);
      const from = ids.indexOf(dragId), to = ids.indexOf(targetId);
      ids.splice(to, 0, ids.splice(from, 1)[0]);
      onReorder(ids);
    }
    setDragId(null); setOverId(null);
  };

  return (
    <div className="tabs" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap' }}>
      {tabs.map(t => (
        <div key={t.id}
          className={`tab${t.id === activeTabId ? ' active' : ''}`}
          draggable={editingId !== t.id}
          onDragStart={() => setDragId(t.id)}
          onDragOver={e => { e.preventDefault(); if (overId !== t.id) setOverId(t.id); }}
          onDrop={() => drop(t.id)}
          onDragEnd={() => { setDragId(null); setOverId(null); }}
          onClick={() => { if (editingId !== t.id) onSelect(t.id); }}
          onDoubleClick={() => { setEditingId(t.id); setEditName(t.name); }}
          style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer',
            opacity: dragId === t.id ? 0.4 : 1,
            borderLeft: overId === t.id ? '2px solid #1e3a5f' : '2px solid transparent' }}
          title="Click to open · double-click to rename · drag to reorder">
          <span style={{ opacity: 0.4, fontSize: 11, letterSpacing: -2 }}>⋮⋮</span>
          {editingId === t.id ? (
            <input autoFocus value={editName}
              onChange={e => setEditName(e.target.value)}
              onClick={e => e.stopPropagation()}
              onBlur={() => submitRename(t.id)}
              onKeyDown={e => { if (e.key === 'Enter') submitRename(t.id); if (e.key === 'Escape') setEditingId(null); }}
              style={{ font: 'inherit', width: 120, padding: '2px 4px' }} />
          ) : (
            <span>{TAB_ICON(t)} {t.name}</span>
          )}
          <span style={{ opacity: 0.4, fontSize: 12 }} title="Move to Trash"
            onClick={e => { e.stopPropagation(); if (confirmDelete(t)) onDelete(t.id); }}>✕</span>
        </div>
      ))}

      {adding ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 12px' }}>
          <input autoFocus className="form-input" placeholder="Tab name" value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') submitAdd(); if (e.key === 'Escape') setAdding(false); }}
            style={{ width: 130 }} />
          <select value={newType} onChange={e => setNewType(e.target.value)}
            style={{ padding: '7px 8px', border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 13, fontFamily: 'inherit' }}>
            <option value="schedule">📅 Schedule board</option>
            <option value="deliverables">📋 Deliverables table</option>
            <option value="exhibits">🏢 Exhibits table</option>
            <option value="sponsorlist">🤝 Sponsors table</option>
            <option value="souvenir">🎁 Souvenir table</option>
            <option value="toc">📑 TOC table</option>
            <option value="vipads">⭐ VIP Ads table</option>
          </select>
          <button className="btn btn-navy btn-sm" onClick={submitAdd}>Add</button>
          <button className="btn btn-ghost btn-sm" onClick={() => setAdding(false)}>Cancel</button>
        </div>
      ) : (
        <div className="tab" style={{ cursor: 'pointer', opacity: 0.75 }} onClick={() => setAdding(true)}>+ Add Tab</div>
      )}

      {trash.length > 0 && (
        <div style={{ position: 'relative', marginLeft: 'auto' }}>
          <div className="tab" style={{ cursor: 'pointer', opacity: 0.85 }} onClick={() => setShowTrash(v => !v)}>
            🗑 Trash ({trash.length})
          </div>
          {showTrash && (
            <div style={{ position: 'absolute', right: 0, top: '100%', background: 'white', border: '1px solid #e2e8f0',
              borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.14)', zIndex: 80, minWidth: 300, padding: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#718096', textTransform: 'uppercase', letterSpacing: 1, padding: '4px 6px 8px' }}>
                Trash · restorable for 30 days
              </div>
              {trash.map(t => (
                <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px', borderTop: '1px solid #f1f5f9' }}>
                  <span style={{ flex: 1, fontSize: 13, color: '#1a202c' }}>
                    {TAB_ICON(t)} {t.name}
                    <span style={{ color: '#a0aec0', fontSize: 11 }}> · {Number(t.item_count || 0)} {TAB_UNIT(t)}{Number(t.item_count) === 1 ? '' : 's'}</span>
                  </span>
                  <button className="btn btn-navy btn-sm" style={{ padding: '2px 8px' }}
                    onClick={() => { onRestore(t.id); setShowTrash(false); }}>Restore</button>
                  <button className="btn btn-danger btn-sm" style={{ padding: '2px 8px' }}
                    onClick={() => onPurge(t.id)} title="Delete forever">🗑</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────
export default function MainPage() {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const [tabs, setTabs] = useState([]);
  const [trash, setTrash] = useState([]);
  const [activeTabId, setActiveTabId] = useState(null);
  const [sponsors, setSponsors] = useState([]);
  const [scheduleByTab, setScheduleByTab] = useState({}); // tabId -> days[]
  const [delivByTab, setDelivByTab] = useState({});       // tabId -> { deliverables, matrix }
  const [exhibitsByTab, setExhibitsByTab] = useState({}); // tabId -> rows[]
  const [loading, setLoading] = useState(true);

  // Initial load: tabs + sponsors (tab contents load lazily)
  useEffect(() => {
    if (!user) { navigate('/login'); return; }
    Promise.all([api.get('/tabs'), api.get('/sponsors')])
      .then(([t, sp]) => {
        setTabs(t.data);
        setSponsors(sp.data);
        if (t.data.length) setActiveTabId(t.data[0].id);
      }).catch(console.error)
      .finally(() => setLoading(false));
    api.get('/tabs/trash').then(r => setTrash(r.data)).catch(() => {});
  }, [user]);

  const refreshTrash = () => api.get('/tabs/trash').then(r => setTrash(r.data)).catch(() => {});

  // Lazy-load the active tab's contents on first view
  useEffect(() => {
    if (!activeTabId) return;
    const t = tabs.find(x => x.id === activeTabId);
    if (!t) return;
    if (t.type === 'schedule' && scheduleByTab[activeTabId] === undefined) {
      api.get(`/schedule?tab_id=${activeTabId}`)
        .then(r => setScheduleByTab(p => ({ ...p, [activeTabId]: r.data }))).catch(console.error);
    }
    if (t.type === 'deliverables' && delivByTab[activeTabId] === undefined) {
      api.get(`/deliverables?tab_id=${activeTabId}`)
        .then(r => setDelivByTab(p => ({ ...p, [activeTabId]: { deliverables: r.data.deliverables, matrix: r.data.matrix } }))).catch(console.error);
    }
    if (isTableType(t.type) && exhibitsByTab[activeTabId] === undefined) {
      api.get(`/exhibits?tab_id=${activeTabId}`)
        .then(r => setExhibitsByTab(p => ({ ...p, [activeTabId]: r.data }))).catch(console.error);
    }
  }, [activeTabId, tabs]);

  // Background auto-refresh every 15s so edits from other people show up.
  // In-progress typing is safe: NotesCell/TypedCell keep their own local state and
  // ignore prop changes while you edit, and they auto-save before the next refresh.
  useEffect(() => {
    if (!user) return;
    const id = setInterval(() => {
      if (document.hidden) return; // skip while tab not visible
      api.get('/sponsors').then(r => setSponsors(r.data)).catch(() => {});
      api.get('/tabs').then(r => setTabs(r.data)).catch(() => {});
      if (!activeTabId) return;
      const t = tabs.find(x => x.id === activeTabId);
      if (t?.type === 'schedule') {
        api.get(`/schedule?tab_id=${activeTabId}`)
          .then(r => setScheduleByTab(p => ({ ...p, [activeTabId]: r.data }))).catch(() => {});
      } else if (t?.type === 'deliverables') {
        api.get(`/deliverables?tab_id=${activeTabId}`)
          .then(r => setDelivByTab(p => ({ ...p, [activeTabId]: { deliverables: r.data.deliverables, matrix: r.data.matrix } }))).catch(() => {});
      } else if (isTableType(t?.type)) {
        api.get(`/exhibits?tab_id=${activeTabId}`)
          .then(r => setExhibitsByTab(p => ({ ...p, [activeTabId]: r.data }))).catch(() => {});
      }
    }, 15000);
    return () => clearInterval(id);
  }, [user, activeTabId, tabs]);

  // Per-tab state setters that behave like useState updaters for the active tab
  const setActiveSchedule = (updater) =>
    setScheduleByTab(prev => ({ ...prev, [activeTabId]: typeof updater === 'function' ? updater(prev[activeTabId] || []) : updater }));
  const setActiveDeliverables = (updater) =>
    setDelivByTab(prev => {
      const cur = prev[activeTabId] || { deliverables: [], matrix: {} };
      const nd = typeof updater === 'function' ? updater(cur.deliverables) : updater;
      return { ...prev, [activeTabId]: { ...cur, deliverables: nd } };
    });
  const setActiveMatrix = (updater) =>
    setDelivByTab(prev => {
      const cur = prev[activeTabId] || { deliverables: [], matrix: {} };
      const nm = typeof updater === 'function' ? updater(cur.matrix) : updater;
      return { ...prev, [activeTabId]: { ...cur, matrix: nm } };
    });
  const setActiveExhibits = (updater) =>
    setExhibitsByTab(prev => ({ ...prev, [activeTabId]: typeof updater === 'function' ? updater(prev[activeTabId] || []) : updater }));

  // Push companies from a Sponsors table into the shared sponsor pool (used by Deliverables & Product Theatre)
  const handleSyncSponsors = async (tableRows) => {
    const payload = tableRows
      .map(r => ({
        name: (r.data?.company || '').trim(),
        status: String(r.data?.status || '').toLowerCase() === 'confirmed' ? 'confirmed' : 'probable',
      }))
      .filter(s => s.name);
    if (!payload.length) { alert('No company names found to sync.'); return; }
    const r = await api.post('/sponsors/sync', { sponsors: payload });
    setSponsors(r.data.sponsors);
    alert(`Synced to Deliverables: ${r.data.added} added, ${r.data.updated} updated.`);
  };

  // Sponsors are a global pool shared across every tab
  const handleAddSponsor = async (name, status) => {
    const r = await api.post('/sponsors', { name, status });
    setSponsors(prev => [...prev, r.data]);
  };

  const handleDeleteSponsor = async (id) => {
    await api.delete(`/sponsors/${id}`);
    setSponsors(prev => prev.filter(s => s.id !== id));
    // Drop the sponsor from every cached schedule's assignments
    setScheduleByTab(prev => {
      const u = {};
      for (const [k, days] of Object.entries(prev)) {
        u[k] = days.map(d => ({ ...d, slots: d.slots.map(slot => ({ ...slot, assignments: slot.assignments.filter(a => a.sponsor_id !== id) })) }));
      }
      return u;
    });
    // Drop the sponsor's row from every cached deliverables matrix
    setDelivByTab(prev => {
      const u = {};
      for (const [k, v] of Object.entries(prev)) {
        const m = { ...v.matrix }; delete m[id];
        u[k] = { ...v, matrix: m };
      }
      return u;
    });
  };

  const handleStatusChange = async (id, status) => {
    await api.put(`/sponsors/${id}`, { status });
    setSponsors(prev => prev.map(s => s.id === id ? { ...s, status } : s));
  };

  // Tabs CRUD
  const handleAddTab = async (name, type) => {
    const r = await api.post('/tabs', { name, type });
    setTabs(prev => [...prev, r.data]);
    setActiveTabId(r.data.id);
  };
  const handleRenameTab = async (id, name) => {
    await api.put(`/tabs/${id}`, { name });
    setTabs(prev => prev.map(t => t.id === id ? { ...t, name } : t));
  };
  const handleDeleteTab = async (id) => {
    await api.delete(`/tabs/${id}`); // soft-delete (moves to Trash)
    setTabs(prev => {
      const nt = prev.filter(t => t.id !== id);
      if (activeTabId === id) setActiveTabId(nt[0]?.id || null);
      return nt;
    });
    setScheduleByTab(p => { const u = { ...p }; delete u[id]; return u; });
    setDelivByTab(p => { const u = { ...p }; delete u[id]; return u; });
    setExhibitsByTab(p => { const u = { ...p }; delete u[id]; return u; });
    refreshTrash();
  };

  const handleRestoreTab = async (id) => {
    await api.post(`/tabs/${id}/restore`);
    const r = await api.get('/tabs');
    setTabs(r.data);
    setActiveTabId(id); // jump to the restored tab
    refreshTrash();
  };

  const handlePurgeTab = async (id) => {
    if (!window.confirm('Permanently delete this tab and all its data? This cannot be undone.')) return;
    await api.delete(`/tabs/${id}/permanent`);
    refreshTrash();
  };
  const handleReorderTabs = async (ids) => {
    setTabs(prev => ids.map(id => prev.find(t => t.id === id)).filter(Boolean));
    try { await api.post('/tabs/reorder', { ids }); } catch { /* keep optimistic order */ }
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

  const activeTab = tabs.find(t => t.id === activeTabId);

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
      <TabBar
        tabs={tabs}
        activeTabId={activeTabId}
        onSelect={setActiveTabId}
        onAdd={handleAddTab}
        onRename={handleRenameTab}
        onDelete={handleDeleteTab}
        onReorder={handleReorderTabs}
        trash={trash}
        onRestore={handleRestoreTab}
        onPurge={handlePurgeTab}
      />

      {/* Content */}
      {!activeTab && (
        <div style={{ textAlign: 'center', color: '#a0aec0', padding: 48 }}>
          No tabs yet — click “+ Add Tab”.
        </div>
      )}

      {activeTab?.type === 'schedule' && (
        scheduleByTab[activeTabId] === undefined
          ? <div style={{ padding: 24, color: '#718096' }}>Loading…</div>
          : <ScheduleTab
              key={activeTabId}
              sponsors={sponsors}
              schedule={scheduleByTab[activeTabId]}
              setSchedule={setActiveSchedule}
              tabId={activeTabId}
              onAddSponsor={handleAddSponsor}
              onDeleteSponsor={handleDeleteSponsor}
              onStatusChange={handleStatusChange}
            />
      )}

      {activeTab?.type === 'deliverables' && (
        delivByTab[activeTabId] === undefined
          ? <div style={{ padding: 24, color: '#718096' }}>Loading…</div>
          : <DeliverablesTab
              key={activeTabId}
              sponsors={sponsors}
              deliverables={delivByTab[activeTabId].deliverables}
              setDeliverables={setActiveDeliverables}
              matrix={delivByTab[activeTabId].matrix}
              setMatrix={setActiveMatrix}
              tabId={activeTabId}
            />
      )}

      {isTableType(activeTab?.type) && (
        exhibitsByTab[activeTabId] === undefined
          ? <div style={{ padding: 24, color: '#718096' }}>Loading…</div>
          : <TableTab
              key={activeTabId}
              rows={exhibitsByTab[activeTabId]}
              setRows={setActiveExhibits}
              tabId={activeTabId}
              cols={TABLE_COLS[activeTab.type]}
              noun={activeTab.type === 'sponsorlist' ? 'sponsor' : isSouvenirFamily(activeTab.type) ? 'row' : 'exhibitor'}
              title={activeTab.name}
              onSync={activeTab.type === 'sponsorlist' ? handleSyncSponsors : null}
              strikeDelete={isSouvenirFamily(activeTab.type)}
            />
      )}
    </div>
  );
}
