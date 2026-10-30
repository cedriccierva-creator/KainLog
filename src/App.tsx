import { HashRouter } from 'react-router-dom';
import AppRoutes from './AppRoutes';

/**
 * HashRouter keeps offline deep links and a future Capacitor file:// shell
 * working without server-side rewrites.
 */
export default function App() {
  return (
    <HashRouter>
      <AppRoutes />
    </HashRouter>
  );
}
