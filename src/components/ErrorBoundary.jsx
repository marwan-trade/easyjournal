import { Component } from 'react';
import Logo from './Logo.jsx';

/** Évite l'écran noir : si une erreur survient à l'affichage, on montre un message et un bouton pour repartir. */
export default class ErrorBoundary extends Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) { console.error('EasyJournal :', error, info?.componentStack); }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <main className="crash" role="alert">
        <Logo size={44} />
        <h1>Oups, un problème est survenu</h1>
        <p>Tes données sont intactes : elles sont enregistrées sur cet appareil. Recharge la page pour continuer.</p>
        <pre>{String(this.state.error?.message ?? this.state.error)}</pre>
        <div className="row">
          <button className="btn primary" onClick={() => location.reload()}>Recharger la page</button>
          <button className="btn" onClick={() => { location.hash = '#/'; this.setState({ error: null }); }}>Retour au tableau de bord</button>
        </div>
        <small>Si cela se reproduit, envoie-moi le message ci-dessus et ce que tu venais de faire.</small>
      </main>
    );
  }
}
