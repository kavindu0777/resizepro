import { Link } from "react-router-dom";
import "./Home.css";

function Home() {
  return (
    <main className="home-page">

      {/* HERO SECTION */}

      <section className="hero-section">

        <div className="hero-container">

          <div className="hero-content">

            <h1>
              Resize Images
              <br />
              &amp; Videos
              <br />
              <span>Easily</span> Online
            </h1>

            <p className="hero-description">
              Resize your images and videos quickly and easily
              with our free online tools. No signup required.
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
                  ▶
                </div>

                <div className="video-controls">

                  <span className="small-play">
                    ▶
                  </span>

                  <div className="progress-bar">

                    <div className="progress"></div>

                    <div className="progress-dot"></div>

                  </div>

                  <span className="volume">
                    ◖
                  </span>

                </div>

              </div>

            </div>


            <div className="tool-card image-card">

              <div className="tool-icon">
                🖼
              </div>

              <h2>
                Image Resizer
              </h2>

              <p>
                Resize, crop, and optimize your images
                in just a few clicks.
              </p>

              <Link
                to="/image-resizer"
                className="tool-button"
              >
                Resize Image
                <span>→</span>
              </Link>

            </div>


            <div className="tool-card video-card">

              <div className="tool-icon">
                ▣
              </div>

              <h2>
                Video Resizer
              </h2>

              <p>
                Resize, compress, and optimize your
                videos easily.
              </p>

              <Link
                to="/video-resizer"
                className="tool-button"
              >
                Resize Video
                <span>→</span>
              </Link>

            </div>

          </div>

        </div>

      </section>


      {/* FEATURES */}

      <section className="features-section">

        <div className="features-container">

          <div className="feature-item">

            <div className="feature-icon">
              ⚡
            </div>

            <div>
              <h3>Fast &amp; Easy</h3>

              <p>
                Resize your files in seconds
                with our fast processing engine.
              </p>
            </div>

          </div>


          <div className="feature-divider"></div>


          <div className="feature-item">

            <div className="feature-icon">
              🛡
            </div>

            <div>
              <h3>Secure &amp; Private</h3>

              <p>
                Your files are safe with us.
                We don't store your uploads.
              </p>
            </div>

          </div>


          <div className="feature-divider"></div>


          <div className="feature-item">

            <div className="feature-icon">
              📱
            </div>

            <div>
              <h3>Works Everywhere</h3>

              <p>
                Use our tools on any device
                – desktop, tablet, or mobile.
              </p>
            </div>

          </div>


          <div className="feature-divider"></div>


          <div className="feature-item">

            <div className="feature-icon">
              ⚙
            </div>

            <div>
              <h3>High Quality</h3>

              <p>
                Get the best quality output
                with optimized file size.
              </p>
            </div>

          </div>

        </div>

      </section>

    </main>
  );
}

export default Home;