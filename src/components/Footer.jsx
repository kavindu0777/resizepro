import { Link } from "react-router-dom";
import "./Footer.css";

// Replace "#" with your real profile URLs. Until then the links do nothing.
const SOCIAL_LINKS = [
  { label: "Facebook", short: "f", href: "#" },
  { label: "X (Twitter)", short: "𝕏", href: "#" },
  { label: "Instagram", short: "◎", href: "#" },
  { label: "LinkedIn", short: "in", href: "#" },
];

function Footer() {
  return (
    <footer className="footer">
      <div className="footer-container">
        <div className="footer-brand">
          <Link to="/" className="footer-logo">
            <span className="footer-logo-icon" aria-hidden="true">
              ↗
            </span>

            <span className="footer-logo-text">
              Resize<span>Pro</span>
            </span>
          </Link>

          <p>© 2024–{new Date().getFullYear()} ResizePro. All rights reserved.</p>
        </div>

        <div className="footer-column">
          <h3>Tools</h3>
          <Link to="/image-resizer">Image Resizer</Link>
          <Link to="/video-resizer">Video Resizer</Link>
        </div>

        <div className="footer-column">
          <h3>Company</h3>
          <Link to="/about">About Us</Link>
          <Link to="/contact">Contact Us</Link>
        </div>

        <div className="footer-column">
          <h3>Support</h3>
          <Link to="/faq">FAQ</Link>
          <Link to="/privacy-policy">Privacy Policy</Link>
        </div>

        <div className="footer-column">
          <h3>Follow Us</h3>

          <div className="social-icons">
            {SOCIAL_LINKS.map((item) => {
              const isPlaceholder = item.href === "#";

              return (
                <a
                  key={item.label}
                  href={item.href}
                  aria-label={item.label}
                  title={item.label}
                  target={isPlaceholder ? undefined : "_blank"}
                  rel={isPlaceholder ? undefined : "noopener noreferrer"}
                  onClick={
                    isPlaceholder ? (event) => event.preventDefault() : undefined
                  }
                >
                  <span aria-hidden="true">{item.short}</span>
                </a>
              );
            })}
          </div>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
