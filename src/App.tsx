import { BrowserRouter, Routes, Route } from 'react-router-dom';
import TestSupabase from '@/pages/TestSupabase';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<div>Welcome to Edu Intel Spark</div>} />
        <Route path="/test" element={<TestSupabase />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
