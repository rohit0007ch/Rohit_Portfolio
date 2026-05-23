import "./styles/Resume.css";
import { TbDownload } from "react-icons/tb";
import { RESUME_URL, RESUME_DOWNLOAD_NAME } from "../constants/resume";

const Resume = () => {
  return (
    <section className="resume-section section-container" id="resume">
      <div className="resume-header">
        <h2>
          Resume <span>Preview</span>
        </h2>
        <p className="resume-subtitle">
          iOS &amp; Flutter developer — download or view below
        </p>
        <a
          className="resume-download-btn"
          href={RESUME_URL}
          download={RESUME_DOWNLOAD_NAME}
          data-cursor="disable"
        >
          <TbDownload aria-hidden="true" />
          Download PDF
        </a>
      </div>
      <div className="resume-preview-wrap">
        <iframe
          className="resume-preview-frame"
          src={`${RESUME_URL}#toolbar=0&navpanes=0`}
          title="Rohit iOS Developer Resume"
        />
        <p className="resume-preview-fallback">
          PDF preview not supported in your browser.{" "}
          <a href={RESUME_URL} download={RESUME_DOWNLOAD_NAME} data-cursor="disable">
            Download the resume
          </a>{" "}
          instead.
        </p>
      </div>
    </section>
  );
};

export default Resume;
