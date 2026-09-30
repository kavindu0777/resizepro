import { Link } from "react-router-dom";
import {
  ArrowRight,
  BadgeCheck,
  Image,
  MonitorSmartphone,
  Play,
  ShieldCheck,
  Video,
  Zap,
} from "lucide-react";
import "./Home.css";

function Home() {
  return (
    <main className="home-page">
      <section className="hero-section">
        <div className="hero-container">
          <div className="hero-content">
            <h1>
              Resize Images
              <br />
              & Videos
              <br />
              <span>Easily</span> Online
            </h1>

            <p className="hero-description">
              Resize your images and videos quickly and easily with our free
              online tools. No signup required.
            </p>

            <div className="hero-benefits">
              <div className="benefit">
                <span className="check-icon">✓</span>
                <span>100% Free</span>
              </div>
              <div className="benefit">
                <span className="check-icon">✓</span>
                <span>No Watermark</span>
              </div>
            </div>
          </div>

          <div className="hero-tools">
            <div className="image-preview">
              <div className="preview-sun"></div>
              <div className="mountain mountain-dark"></div>
              <div className="mountain mountain-yellow"></div>
              <div className="resize-corner top-left"></div>
              <div className="resize-corner top-right"></div>
              <div className="resize-corner bottom-left"></div>
              <div className="resize-corner bottom-right"></div>
            </div>

            <div className="video-preview">
              <div className="video-screen">
                <div className="play-button">
                  <Play size={22} fill="currentColor" strokeWidth={0} />
                </div>
                <div className="video-controls">
                  <span className="small-play">
                    <Play size={14} fill="currentColor" strokeWidth={0} />
                  </span>
                  <div className="progress-bar">
                    <div className="progress"></div>
                    <div className="progress-dot"></div>
                  </div>
                </div>
              </div>
            </div>

            <article className="tool-card home-image-card">
              <div className="tool-icon">
                <Image size={30} strokeWidth={1.75} />
              </div>
              <h2>Image Resizer</h2>
              <p>Resize, crop, and optimize your images in just a few clicks.</p>
              <Link to="/image-resizer" className="tool-button">
                Resize Image
                <ArrowRight size={16} strokeWidth={2} />
              </Link>
            </article>

            <article className="tool-card home-video-card">
              <div className="tool-icon">
                <Video size={30} strokeWidth={1.75} />
              </div>
              <h2>Video Resizer</h2>
              <p>Resize, compress, and optimize your videos easily.</p>
              <Link to="/video-resizer" className="tool-button">
                Resize Video
                <ArrowRight size={16} strokeWidth={2} />
              </Link>
            </article>
          </div>
        </div>
      </section>

      <section className="features-section">
        <div className="features-container">
          <div className="feature-item">
            <div className="feature-icon">
              <Zap size={26} strokeWidth={1.75} />
            </div>
            <div>
              <h3>Fast & Easy</h3>
              <p>Resize your files in seconds with our fast processing engine.</p>
            </div>
          </div>
          <div className="feature-divider"></div>
          <div className="feature-item">
            <div className="feature-icon">
              <ShieldCheck size={26} strokeWidth={1.75} />
            </div>
            <div>
              <h3>Secure & Private</h3>
              <p>Your files are safe with us. We don't store your uploads.</p>
            </div>
          </div>
          <div className="feature-divider"></div>
          <div className="feature-item">
            <div className="feature-icon">
              <MonitorSmartphone size={26} strokeWidth={1.75} />
            </div>
            <div>
              <h3>Works Everywhere</h3>
              <p>Use our tools on any device – desktop, tablet, or mobile.</p>
            </div>
          </div>
          <div className="feature-divider"></div>
          <div className="feature-item">
            <div className="feature-icon">
              <BadgeCheck size={26} strokeWidth={1.75} />
            </div>
            <div>
              <h3>High Quality</h3>
              <p>Get the best quality output with optimized file size.</p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

export default Home;
