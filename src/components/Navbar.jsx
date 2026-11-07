import { useEffect, useRef } from "react";
import { Link, NavLink } from "react-router-dom";
import "./Navbar.css";

const LINKS = [
  { to: "/", label: "Home", end: true },
  { to: "/image-resizer", label: "Image Resizer" },
  { to: "/video-resizer", label: "Video Resizer" },
  { to: "/about", label: "About Us" },
  { to: "/contact", label: "Contact" },
];

function Navbar() {
  const headerRef = useRef(null);

  // The navbar wraps onto two rows below 1180px, so it is not always 78px.
  // The editors use --nav-height to fill the rest of the screen exactly.
  useEffect(() => {
    const header = headerRef.current;

    if (!header) {
      return undefined;
    }

    const update = () => {
      document.documentElement.style.setProperty(
        "--nav-height",
        `${Math.ceil(header.getBoundingClientRect().height)}px`
      );
    };

    update();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", update);
      return () => window.removeEventListener("resize", update);
    }

    const observer = new ResizeObserver(update);
    observer.observe(header);

    return () => observer.disconnect();
  }, []);

  return (
    <header className="navbar" ref={headerRef}>
      <div className="navbar-container">
        <Link to="/" className="logo">
          <span className="logo-icon" aria-hidden="true">
            ↗
          </span>

          <span className="logo-text">
            Resize<span>Pro</span>
          </span>
        </Link>

        <nav className="nav-links" aria-label="Main">
          {LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) =>
                isActive ? "nav-link active" : "nav-link"
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
      </div>
    </header>
  );
}

export default Navbar;
