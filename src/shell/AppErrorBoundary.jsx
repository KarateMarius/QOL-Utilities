import { Component } from "react";

// Faengt Abstuerze einer App ab, damit sie nicht den ganzen Bildschirm
// mitnehmen. Ohne das reisst ein einzelner Fehler in einer Komponente den
// gesamten Baum ab - React haengt dann alles aus, samt Rahmen und Rueckweg,
// und es bleibt eine weisse Seite.
//
// Das geht nur als Klasse: componentDidCatch hat kein Gegenstueck als Hook.
//
// Der Schluessel am Element ist die App-Kennung. Dadurch faengt der Abfang
// beim Wechsel zu einer anderen App von vorn an, statt den Fehler der alten
// weiterzuzeigen.
export default class AppErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // In die Konsole, damit der Fehler nicht nur schoen aussieht, sondern
    // auch auffindbar bleibt.
    console.error(`[${this.props.appName}] abgestürzt:`, error, info?.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="app-crash">
        <h2 className="app-crash__title">{this.props.appName} ist abgestürzt</h2>
        <p className="app-crash__text">
          Der Fehler steckt in der App, nicht in deinen Daten — gespeicherte Grundrisse,
          Watchlist und Einkaufskorb sind unberührt.
        </p>
        <p className="app-crash__detail">{String(this.state.error?.message || this.state.error)}</p>

        <div className="app-crash__actions">
          <button
            type="button"
            className="app-crash__button"
            onClick={() => this.setState({ error: null })}
          >
            Nochmal versuchen
          </button>
          <button type="button" className="app-crash__button" onClick={this.props.onHome}>
            Zur Übersicht
          </button>
        </div>
      </div>
    );
  }
}
