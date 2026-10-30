import { HashRouter } from 'react-router-dom';
import AppRoutes from './AppRoutes';
import NativeBackHandler from './components/NativeBackHandler';
import UpdatePrompt from './components/UpdatePrompt';

/**
 * HashRouter keeps offline deep links and a future Capacitor file:// shell
 * working without server-side rewrites.
 */
export default function App() {
  return (
    <HashRouter>
      <AppRoutes />
      <NativeBackHandler />
      <UpdatePrompt />
    </HashRouter>
  );
}
