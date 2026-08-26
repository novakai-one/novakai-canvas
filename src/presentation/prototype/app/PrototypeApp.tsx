/** The persistent Novakai shell with Canvas as its sole product area. */
import './prototype-app.css';
import { NavigationRail } from '../components/NavigationRail/NavigationRail';
import { CanvasRoom } from '../rooms/Canvas/CanvasRoom';

export default function PrototypeApp() {
  return (
    <div className="prototype-shell">
      <NavigationRail />
      <div className="prototype-shell__main">
        <main className="prototype-shell__workspace">
          <CanvasRoom />
        </main>
      </div>
    </div>
  );
}
