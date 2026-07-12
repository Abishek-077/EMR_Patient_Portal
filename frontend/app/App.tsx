import { BrowserRouter } from 'react-router-dom';
import { AuthGate } from '../features/auth';

function App() {
  return (
    <BrowserRouter>
      <AuthGate />
    </BrowserRouter>
  );
}

export default App;
