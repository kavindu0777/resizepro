import { Link, NavLink } from "react-router-dom";
import "./Navbar.css";

function Navbar() {
  return (
    <header className="navbar">
      <div className="navbar-container">

        <Link to="/" className="logo">
          <span className="logo-icon">↗</span>

          <span className="logo-text">
            Resize<span>Pro</span>
          </span>
        </Link>

        <nav className="nav-links">

          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              isActive ? "nav-link active" : "nav-link"
            }
          >
            Home
          </NavLink>

          <NavLink
            to="/image-resizer"
            className={({ isActive }) =>
              isActive ? "nav-link active" : "nav-link"
            }
          >
            Image Resizer
          </NavLink>

          <NavLink
            to="/video-resizer"
            className={({ isActive }) =>
              isActive ? "nav-link active" : "nav-link"
            }
          >
            Video Resizer
          </NavLink>

          <NavLink
            to="/about"
            className={({ isActive }) =>
              isActive ? "nav-link active" : "nav-link"
            }
          >
            About Us
          </NavLink>

          <NavLink
            to="/contact"
            className={({ isActive }) =>
              isActive ? "nav-link active" : "nav-link"
            }
          >
            Contact
          </NavLink>

        </nav>

      </div>
    </header>
  );
}

export default Navbar;