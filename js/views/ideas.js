import { h, icon, toast } from '../components/ui.js';
import { state, saveIdea, deleteIdea } from '../store/state.js';

const STATUS = [['todo', 'À faire'], ['doing', 'En cours'], ['done', 'Fait']];

/** Suggestions de départ : un clic pour les ajouter à ta liste. */
const SUGGESTIONS = [
  'Checklist à valider avant chaque trade',
  'Revue hebdomadaire guidée',
  'Mode hors ligne (installation comme une application)',
  'Calendrier mensuel des résultats',
  'Objectifs mensuels (taux de réussite, nombre de trades)',
  'Comparaison par session de marché (Londres, New York)',
];

export function render(root) {
  const page = h('div', { class: 'page' });
  root.append(page);

  const title = h('input', { id: 'idea-title', type: 'text', maxlength: 120, placeholder: 'Une fonctionnalité que tu voudrais' });
  const desc = h('textarea', { id: 'idea-desc', rows: 2, placeholder: 'Pourquoi, comment tu l’imagines (facultatif)' });
  const form = h('form', { class: 'card', novalidate: true, onSubmit: async (e) => {
    e.preventDefault();
    if (!title.value.trim()) { title.focus(); toast('Donne un titre à ton idée.', 'error'); return; }
    await saveIdea({ title: title.value, description: desc.value });
    toast('Idée ajoutée.');
  } },
    h('div', { class: 'card-head' }, h('h2', {}, 'Nouvelle idée')),
    h('div', { class: 'form-grid' },
      h('div', { class: 'field wide' }, h('label', { for: 'idea-title' }, 'Titre'), title),
      h('div', { class: 'field wide' }, h('label', { for: 'idea-desc' }, 'Description'), desc),
    ),
    h('div', { style: 'margin-top:12px' }, h('button', { class: 'btn primary', type: 'submit' }, icon('plus'), 'Ajouter')),
  );
  page.append(form);

  const existing = new Set(state.ideas.map((i) => i.title.toLowerCase()));
  const open = SUGGESTIONS.filter((s) => !existing.has(s.toLowerCase()));
  if (open.length) {
    page.append(h('section', { class: 'card' },
      h('div', { class: 'card-head' }, h('h2', {}, 'Suggestions')),
      h('div', { class: 'chips' }, open.map((s) => h('button', { class: 'chip', type: 'button', onClick: () => saveIdea({ title: s }) }, `+ ${s}`))),
    ));
  }

  const cols = STATUS.map(([key, label]) => {
    const items = state.ideas.filter((i) => i.status === key).sort((a, b) => a.createdAt - b.createdAt);
    return h('section', { class: 'card' },
      h('div', { class: 'card-head' }, h('h2', {}, `${label} (${items.length})`)),
      items.length === 0 ? h('p', { class: 'muted' }, 'Rien ici.') : h('ul', { class: 'list' }, items.map((i) => h('li', { class: 'list-item' },
        h('div', { style: 'min-width:0' },
          h('strong', {}, i.title),
          i.description ? h('p', { class: 'muted', style: 'margin-top:2px' }, i.description) : null,
          h('select', { class: 'btn small', 'aria-label': `Statut de « ${i.title} »`, style: 'margin-top:8px', onChange: (e) => saveIdea({ ...i, status: e.target.value }) },
            STATUS.map(([v, l]) => h('option', { value: v, selected: v === i.status }, l))),
        ),
        h('button', { class: 'btn ghost icon-only', type: 'button', 'aria-label': `Supprimer l’idée « ${i.title} »`, onClick: () => deleteIdea(i.id) }, icon('trash')),
      ))),
    );
  });
  page.append(h('div', { class: 'grid-3' }, cols));
}
