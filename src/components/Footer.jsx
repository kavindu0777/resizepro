import { Link } from "react-router-dom";
import "./Footer.css";

function Footer() {
  return (
    <footer className="footer">

      <div className="footer-container">

        <div className="footer-brand">

          <Link to="/" className="footer-logo">
            <span className="footer-logo-icon">
              ↗
            </span>

            <span className="footer-logo-text">
              Resize<span>Pro</span>
            </span>
          </Link>

          <p>
            © 2024–2026 ResizePro. All rights reserved.
          </p>

        </div>

        <div className="footer-column">

          <h3>Tools</h3>

          <Link to="/image-resizer">
            Image Resizer
          </Link>

          <Link to="/video-resizer">
            Video Resizer
          </Link>

        </div>

        <div className="footer-column">

          <h3>Company</h3>

          <Link to="/about">
            About Us
          </Link>

          <Link to="/contact">
            Contact Us
          </Link>

        </div>

        <div className="footer-column">

          <h3>Support</h3>

          <Link to="/contact">
            FAQ
          </Link>

          <Link to="/contact">
            Privacy Policy
          </Link>

        </div>

        <div className="footer-column">

          <h3>Follow Us</h3>

          <div className="social-icons">

            <a href="#facebook" onClick={(event) => event.preventDefault()}>
              f
            </a>

            <a href="#twitter" onClick={(event) => event.preventDefault()}>
              𝕏
            </a>

            <a href="#instagram" onClick={(event) => event.preventDefault()}>
              ◎
            </a>

            <a href="#linkedin" onClick={(event) => event.preventDefault()}>
              in
            </a>

          </div>

        </div>

      </div>

    </footer>
  );
}

export default Footer;