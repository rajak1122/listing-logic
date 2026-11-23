import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Dashboard } from "./pages/Dashboard";
import IpoAnalysis from "./pages/IpoAnalysis";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/ipo/:id" element={<IpoAnalysis />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
