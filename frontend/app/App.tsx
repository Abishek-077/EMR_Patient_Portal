import { BrowserRouter } from 'react-router-dom';
import { AuthGate } from '../features/auth';
import { AppErrorBoundary } from '../shared/components/AppErrorBoundary';

function App() {
  return (
    <BrowserRouter>
      <AppErrorBoundary>
        <AuthGate />
      </AppErrorBoundary>
    </BrowserRouter>
  );
}

export default App;
