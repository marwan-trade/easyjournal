import { useMemo, useState } from 'react';
import Dialog from './Dialog.jsx';
import { toast } from './toast.jsx';
import { emptyTrade, normalizeTrade, validateTrade, RESULTS, SIDES, MODE_LABELS } from '../core/domain/trade.js';
import { effectivePnl, pipValueInfo } from '../core/domain/money.js';
import { money } from '../format.js';
import { saveTrade, deleteTrade } from '../store.js';
import ShotField from './ShotField.jsx';
import ShotViewer from './ShotViewer.jsx';

// Défini hors du composant : sinon React recréerait les champs (et perdrait le focus) à chaque frappe.
function Field({ label, children, wide, k, errors }) {
  return <label className={`f ${wide ? 'wide' : ''}`}>{label}{children}{errors[k] && <span className="err" role="alert">{errors[k]}</span>}</label>;
}

const text = (v) => (v === null || v === undefined ? '' : String(v));

/** Formulaire de trade (création et modification) dans une boîte de dialogue. */
export default function TradeForm({ trade, settings, onClose }) {
  const [t, setT] = useState(() => (trade ? { ...trade } : emptyTrade(settings.mode)));
  const [errors, setErrors] = useState({});
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [viewing, setViewing] = useState(false);
  const editing = Boolean(trade);
  const set = (k) => (e) => setT((x) => ({ ...x, [k]: e.target.value }));
  const norm = useMemo(() => normalizeTrade({ ...t, tags: t.tags }), [t]);
  const est = effectivePnl(norm, settings);
  const pv = norm.pair ? pipValueInfo(norm.pair, settings) : null;

  const submit = async (e) => {
    e.preventDefault();
    const clean = normalizeTrade({ ...t, tags: typeof t.tags === 'string' ? t.tags : (t.tags ?? []).join(',') });
    const v = validateTrade(clean);
    setErrors(v.errors);
    if (!v.ok) return;
    await saveTrade(clean);
    toast(editing ? 'Trade modifié.' : 'Trade ajouté.');
    onClose();
  };
  const remove = async () => { await deleteTrade(t.id); toast('Trade supprimé.'); onClose(); };


  const tagsValue = Array.isArray(t.tags) ? t.tags.join(', ') : t.tags;

  return (
    <Dialog title={editing ? 'Modifier le trade' : `Nouveau trade · ${MODE_LABELS[t.mode]}`} onClose={onClose}
      footer={<>
        {editing && (confirmDelete
          ? <><button type="button" className="btn danger" onClick={remove}>Confirmer la suppression</button><button type="button" className="btn" onClick={() => setConfirmDelete(false)}>Garder</button></>
          : <button type="button" className="btn danger" onClick={() => setConfirmDelete(true)} style={{ marginRight: 'auto' }}>Supprimer</button>)}
        <button type="button" className="btn" onClick={onClose}>Annuler</button>
        <button type="submit" form="trade-form" className="btn primary">Enregistrer</button>
      </>}>
      <form id="trade-form" onSubmit={submit} noValidate>
        <div className="formgrid">
          <Field errors={errors} k="date" label="Date"><input type="date" value={t.date} onChange={set('date')} required /></Field>
          <Field errors={errors} k="pair" label="Paire"><input list="pairs" value={t.pair} onChange={set('pair')} placeholder="GBPUSD" autoFocus autoComplete="off" /><datalist id="pairs">{settings.pairs.map((p) => <option key={p} value={p} />)}</datalist></Field>
          <Field errors={errors} k="side" label="Sens"><select value={t.side} onChange={set('side')}><option value="">—</option>{SIDES.map((s) => <option key={s}>{s}</option>)}</select></Field>
          <Field errors={errors} k="scenario" label="Scénario"><input list="scen" value={t.scenario} onChange={set('scenario')} autoComplete="off" /><datalist id="scen">{settings.scenarios.map((p) => <option key={p} value={p} />)}</datalist></Field>
          <Field errors={errors} k="timeframe" label="Confirmation"><input list="tfs" value={t.timeframe} onChange={set('timeframe')} autoComplete="off" /><datalist id="tfs">{settings.timeframes.map((p) => <option key={p} value={p} />)}</datalist></Field>
          <Field errors={errors} k="result" label="Résultat"><select value={t.result} onChange={set('result')}><option value="">En cours</option>{RESULTS.map((r) => <option key={r}>{r}</option>)}</select></Field>
          <Field errors={errors} k="rulesFollowed" label="Règles respectées"><select value={t.rulesFollowed === true ? 'oui' : t.rulesFollowed === false ? 'non' : ''} onChange={(e) => setT((x) => ({ ...x, rulesFollowed: e.target.value === 'oui' ? true : e.target.value === 'non' ? false : null }))}><option value="">Non renseigné</option><option value="oui">Oui</option><option value="non">Non</option></select></Field>
          <Field errors={errors} k="rr" label="RR prévu (1 : x)"><input inputMode="decimal" value={text(t.rr)} onChange={set('rr')} placeholder="2" /></Field>
          <Field errors={errors} k="lots" label="Lots"><input inputMode="decimal" value={text(t.lots)} onChange={set('lots')} placeholder={String(settings.defaultLots).replace('.', ',')} /></Field>
          <Field errors={errors} k="pips" label="Pips"><input inputMode="decimal" value={text(t.pips)} onChange={set('pips')} placeholder="45" /></Field>
          <Field errors={errors} k="risk" label={`Risque (${settings.currency})`}><input inputMode="decimal" value={text(t.risk)} onChange={set('risk')} /></Field>
          <Field errors={errors} k="pnl" label={`Résultat net (${settings.currency})`}><input inputMode="decimal" value={text(t.pnl)} onChange={set('pnl')} placeholder="vide = estimation" /></Field>
          <Field errors={errors} k="fees" label={`Frais (${settings.currency})`}><input inputMode="decimal" value={text(t.fees)} onChange={set('fees')} /></Field>
          <div className="wide est" aria-live="polite">{est ? <>Résultat pris en compte : <b>{est.estimated ? '≈ ' : ''}{money(est.value, settings, { sign: true })}</b>{est.estimated ? ` : ${norm.pips} pips × ${norm.lots > 0 ? norm.lots : settings.defaultLots} lot(s)${norm.lots > 0 ? '' : ' (lot par défaut)'} × ${money(pv.value, settings, { digits: 2 })} par pip${norm.fees ? ' − frais' : ''}` : ' (saisi)'}</> : 'Saisis les pips et les lots : le résultat est calculé tout seul. Ou saisis directement le résultat net de ton courtier.'}
            {pv && est?.estimated && <div className="sub" style={{ marginTop: 4 }}>Valeur du pip pour 1 lot sur {norm.pair} : {money(pv.value, settings, { digits: 2 })} ({pv.source === 'manuel' ? 'fixée par toi dans les réglages' : pv.source === 'calculé' ? 'calculée d\'après la devise de la paire' : 'valeur par défaut : cette paire n\'est pas une paire de devises'}).</div>}</div>
          <Field errors={errors} k="notes" label="Notes" wide><textarea value={t.notes} onChange={set('notes')} placeholder="Ce qui s'est passé, ce que tu as ressenti, ce que tu retiens…" /></Field>
          <div className="wide"><ShotField value={t.screenshot} onChange={(v) => setT((x) => ({ ...x, screenshot: v }))} onView={() => setViewing(true)} /></div>
          <Field errors={errors} k="tags" label="Étiquettes (séparées par des virgules)" wide><input value={tagsValue} onChange={(e) => setT((x) => ({ ...x, tags: e.target.value }))} /></Field>
        </div>
      </form>
      {viewing && t.screenshot && <ShotViewer trade={{ ...t, id: t.id }} list={[]} onClose={() => setViewing(false)} />}
    </Dialog>
  );
}
