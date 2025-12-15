import { Header } from './components/Header';
import { PhotoVault } from './components/PhotoVault';
import './App.css';

function App() {
  return (
    <div className="app">
      <Header userName="demo-user" />
      <main className="flex-1 overflow-y-auto">
        <PhotoVault userId="demo-user" />
      </main>
    </div>
  );
}

export default App;
