import { PropsWithChildren } from "react";
import "./styles/Landing.css";

const Landing = ({ children }: PropsWithChildren) => {
  return (
    <>
      <div className="landing-section" id="landingDiv">
        <div className="landing-container">
          <div className="landing-intro">
            <h2>Hello! I&apos;m</h2>
            <h1>
              ROHIT
              <br />
              <span>&nbsp;</span>
            </h1>
          </div>
          <div className="landing-info">
            <p className="landing-role-eyebrow">A Professional</p>
            <div className="landing-role-display">
              <div className="landing-role-row landing-role-row--accent">
                <div
                  className="landing-role-viewport"
                  data-role-carousel="platform"
                >
                  <span className="landing-role-item is-active">iOS</span>
                  <span className="landing-role-item">Flutter</span>
                </div>
              </div>
              <div className="landing-role-row landing-role-row--title">
                <div
                  className="landing-role-viewport"
                  data-role-carousel="title"
                >
                  <span className="landing-role-item is-active">Developer</span>
                  <span className="landing-role-item">Engineer</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        {children}
      </div>
    </>
  );
};

export default Landing;
