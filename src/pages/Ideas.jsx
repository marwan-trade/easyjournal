import { useState } from 'react';
import { saveIdea, deleteIdea } from '../store.js';

const STATUS = { todo: 'À tester', doing: 'En test', done: 'Terminée' };

export default function Ideas({ state }) {
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const add = async (e) => { e.preventDefault(); if (!title.trim()) return; await saveIdea({ title, description: desc }); setTitle(''); setDesc(''); };
  return (
    <>
      <form className="card" onSubmit={add} style={{ '--i': 0, marginBottom: 16 }}>
        <h2>Nouvelle idée</h2><p className="sub">Une amélioration de ta stratégie, une règle à tester, une question à creuser.</p>
        <div className="set" style={{ marginTop: 10 }}>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Titre" aria-label="Titre" />
          <textarea value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Détails (facultatif)" aria-label="Détails" />
          <div><button className="btn primary" type="submit">Ajouter</button></div>
        </div>
      </form>
      <div className="grid half">
        {state.ideas.length === 0 && <p className="muted">Aucune idée pour l'instant.</p>}
        {[...state.ideas].sort((a, b) => b.createdAt - a.createdAt).map((i, n) => (
          <div className="card" key={i.id} style={{ '--i': n + 1 }}>
            <div className="card-head"><h2>{i.title}</h2>
              <select aria-label="Statut" value={i.status} onChange={(e) => saveIdea({ ...i, status: e.target.value })} style={{ width: 'auto' }}>{Object.entries(STATUS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
            {i.description && <p className="sub" style={{ whiteSpace: 'pre-wrap' }}>{i.description}</p>}
            <button className="btn danger" onClick={() => deleteIdea(i.id)} style={{ marginTop: 10 }}>Supprimer</button>
          </div>
        ))}
      </div>
    </>
  );
}
