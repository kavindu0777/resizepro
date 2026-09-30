
import { BrowserRouter, Routes, Route } from "react-router-dom";

import Navbar from "./components/Navbar";
import Footer from "./components/Footer";

import Home from "./pages/Home";
import VideoResizer from "./pages/VideoResizer";

function Placeholder({ title }) {
  return (
    <div className="placeholder-page">

      <h1>{title}</h1>

      <p>
        This page will be developed separately.
      </p>

    </div>
  );
}

function App() {
  return (
    <BrowserRouter>

      <Navbar />

      <Routes>

        {/* HOME */}

        <Route
          path="/"
          element={<Home />}
        />


        {/* VIDEO RESIZER */}

        <Route
          path="/video-resizer"
          element={<VideoResizer />}
        />


        {/* IMAGE RESIZER */}

        <Route
          path="/image-resizer"
          element={
            <Placeholder title="Image Resizer" />
          }
        />


        {/* ABOUT */}

        <Route
          path="/about"
          element={
            <Placeholder title="About Us" />
          }
        />


        {/* CONTACT */}

        <Route
          path="/contact"
          element={
            <Placeholder title="Contact Us" />
          }
        />

      </Routes>

      <Footer />

    </BrowserRouter>
  );
}

export default App;

