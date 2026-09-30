import { BrowserRouter, Routes, Route } from "react-router-dom";

import Navbar from "./components/Navbar";
import Footer from "./components/Footer";

import Home from "./pages/Home";
import VideoResizer from "./pages/VideoResizer";
import ImageResizer from "./pages/ImageResizer";

function Placeholder({ title }) {
  return (
    <div className="placeholder-page">
      <h1>{title}</h1>
      <p>This page will be developed separately.</p>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Navbar />

      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/video-resizer" element={<VideoResizer />} />
        <Route path="/image-resizer" element={<ImageResizer />} />
        <Route path="/about" element={<Placeholder title="About Us" />} />
        <Route path="/contact" element={<Placeholder title="Contact Us" />} />
      </Routes>

      <Footer />
    </BrowserRouter>
  );
}

export default App;