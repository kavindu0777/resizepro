import { useEffect } from "react";
import {
  BrowserRouter,
  Link,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";

import Navbar from "./components/Navbar";
import Footer from "./components/Footer";

import Home from "./pages/Home";
import VideoResizer from "./pages/VideoResizer";
import ImageResizer from "./pages/ImageResizer";

// React Router keeps the old scroll position when the route changes.
// Without this, clicking a footer link opens the next page at the bottom.
function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [pathname]);

  return null;
}

function Placeholder({ title }) {
  return (
    <div className="placeholder-page">
      <h1>{title}</h1>
      <p>This page will be developed separately.</p>
    </div>
  );
}

function NotFound() {
  return (
    <div className="placeholder-page">
      <h1>Page not found</h1>
      <p>The page you are looking for does not exist.</p>
      <Link to="/" className="placeholder-link">
        Back to home
      </Link>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <Navbar />

      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/video-resizer" element={<VideoResizer />} />
        <Route path="/image-resizer" element={<ImageResizer />} />
        <Route path="/about" element={<Placeholder title="About Us" />} />
        <Route path="/contact" element={<Placeholder title="Contact Us" />} />
        <Route path="/faq" element={<Placeholder title="FAQ" />} />
        <Route
          path="/privacy-policy"
          element={<Placeholder title="Privacy Policy" />}
        />
        <Route path="*" element={<NotFound />} />
      </Routes>

      <Footer />
    </BrowserRouter>
  );
}

export default App;
