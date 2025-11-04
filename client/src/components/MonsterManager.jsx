import React, { useEffect, useState } from 'react';
import { apiGet, apiPost } from '../utils/api.js';
import { useModal } from './Modal';
import { CRWithTooltip } from './CRWithTooltip';
function numberOr(v, d=0){ const n = Number(v); return Number.isFinite(n) ? n : d; }

export default function MonsterManager(){
  const { alert, modal } = useModal();
  const [tab, setTab] = useState('form');
  const [list, setList] = useState([]);
  const [q, setQ] = useState('');

  const [form, setForm] = useState({ name:'', ac:'', hp:'', cr:'', type:'', speed:'', initiativeMod:'' });
  const [jsonText, setJsonText] = useState('[\n  { \"name\": \"Bandit Captain\", \"ac\": 15, \"hp\": 65, \"cr\": 2, \"type\": \"humanoid (any)\", \"speed\": \"30 ft.\", \"initiativeMod\": 2 }\n]');
  const [ddbText, setDdbText] = useState('Goblin\nSmall humanoid (goblinoid), neutral evil\nArmor Class 15 (leather armor, shield)\nHit Points 7 (2d6)\nSpeed 30 ft.\nChallenge 1/4 (50 XP)');

  useEffect(()=>{
    apiGet(`/api/monsters?search=${encodeURIComponent(q)}`)
      .then(r=>r.json())
      .then(setList)
      .catch(err => {
        console.error('Failed to load monsters:', err);
        setList([]);
      });
  },[q]);

  async function createForm(){
    const payload = {
      name: form.name.trim(),
      ac: numberOr(form.ac, undefined),
      hp: numberOr(form.hp, undefined),
      cr: form.cr===''?undefined:Number(form.cr),
      type: form.type||undefined,
      speed: form.speed||undefined,
      initiativeMod: numberOr(form.initiativeMod, undefined),
      source: 'homebrew'
    };
    if(!payload.name){ await alert('Name fehlt'); return; }
    const r = await apiPost('/api/monsters', payload);
    if(!r.ok){ await alert('Fehler beim Anlegen'); return; }
    setForm({ name:'', ac:'', hp:'', cr:'', type:'', speed:'', initiativeMod:'' });
    setQ(payload.name);
  }

  async function importJSON(){
    let arr;
    try {
      arr = JSON.parse(jsonText);
    } catch(err) {
      console.error('JSON parse error:', err);
      await alert('Ungültiges JSON');
      return;
    }
    const payload = Array.isArray(arr) ? arr : arr?.monsters;
    if(!Array.isArray(payload)){ await alert('Erwarte Array oder { monsters: [...] }'); return; }
    const r = await apiPost('/api/monsters/bulk', payload);
    const out = await r.json();
    await alert(`Import OK – erstellt: ${out.created}`);
    setQ('');
  }

  async function importDDB(){
    const r = await apiPost('/api/monsters/import/ddb', { text: ddbText });
    const out = await r.json();
    if(out.error){ await alert(out.error); return; }
    await alert(`DDB-Import OK – erstellt: ${out.created}`);
    setQ('');
  }

  return (
    <>
      {modal}
      <section className="card">
      <div className="flex items-center gap-2 mb-2">
        <h2 className="h2">Kreaturen verwalten</h2>
        <div className="ml-auto flex gap-2">
          {['form','json','ddb'].map(t => (
            <button key={t} className={`btn ${tab===t?'bg-slate-100':''}`} onClick={()=>setTab(t)}>
              {t==='form'?'Eingabemaske':t==='json'?'JSON‑Import':'D&D Beyond Paste'}
            </button>
          ))}
        </div>
      </div>

      {tab==='form' && (
        <div className="grid md:grid-cols-2 gap-3">
          <input className="input" placeholder="Name *" value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/>
          <input className="input" placeholder="Typ (z.B. humanoid)" value={form.type} onChange={e=>setForm({...form,type:e.target.value})}/>
          <input className="input" placeholder="AC" value={form.ac} onChange={e=>setForm({...form,ac:e.target.value})}/>
          <input className="input" placeholder="HP" value={form.hp} onChange={e=>setForm({...form,hp:e.target.value})}/>
          <input className="input" placeholder="CR" value={form.cr} onChange={e=>setForm({...form,cr:e.target.value})}/>
          <input className="input" placeholder="Speed" value={form.speed} onChange={e=>setForm({...form,speed:e.target.value})}/>
          <input className="input" placeholder="Initiative‑Mod" value={form.initiativeMod} onChange={e=>setForm({...form,initiativeMod:e.target.value})}/>
          <div className="flex gap-2 items-center"><button className="btn" onClick={createForm}>Anlegen</button><span className="text-slate-600 text-sm">* Pflichtfeld</span></div>
        </div>
      )}

      {tab==='json' && (
        <div className="grid gap-2">
          <label className="lbl">Array von Monstern oder {'{ monsters:[...] }'}</label>
          <textarea className="input h-48" value={jsonText} onChange={e=>setJsonText(e.target.value)} />
          <div><button className="btn" onClick={importJSON}>JSON importieren</button></div>
        </div>
      )}

      {tab==='ddb' && (
        <div className="grid gap-2">
          <label className="lbl">Füge den kopierten **D&D Beyond** Statblock (Text) hier ein:</label>
          <textarea className="input h-48" value={ddbText} onChange={e=>setDdbText(e.target.value)} />
          <div className="text-sm text-slate-600">Hinweis: Der Parser ist rudimentär (Name/Typ/AC/HP/Speed/CR).</div>
          <div><button className="btn" onClick={importDDB}>DDB‑Text importieren</button></div>
        </div>
      )}

      <div className="divider my-3"></div>

      <input className="input w-full" placeholder="Suchen …" value={q} onChange={e=>setQ(e.target.value)} />
      <ul className="divide-y mt-2 max-h-64 overflow-auto">
        {list.map(m => (
          <li key={m.id} className="py-2 flex items-center justify-between gap-2">
            <div>
              <div className="font-medium">{m.name}</div>
              <div className="text-sm text-slate-600">
                {m.cr !== undefined && m.cr !== null ? (
                  <CRWithTooltip monster={m} displayCR={m.cr} className="inline-block" />
                ) : (
                  <span>CR —</span>
                )}
                {' · AC '}{m.ac ?? '—'}{' · HP '}{m.hp ?? '—'}{' · '}{m.type||''}
              </div>
            </div>
            <button className="btn" onClick={async()=>{ await fetch(API(`/api/monsters/${encodeURIComponent(m.id)}`), { method:'DELETE' }); setQ(q); }}>Löschen</button>
          </li>
        ))}
      </ul>
    </section>
    </>
  );
}
