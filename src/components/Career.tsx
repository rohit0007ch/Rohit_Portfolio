import "./styles/Career.css";

const Career = () => {
  return (
    <div className="career-section section-container">
      <div className="career-container">
        <h2>
          My career <span>&</span>
          <br /> experience
        </h2>
        <div className="career-info">
          <div className="career-timeline">
            <div className="career-dot"></div>
          </div>
          
          <div className="career-info-box">
            <div className="career-info-in">
              <div className="career-role">
                <h4>Junior iOS Developer</h4>
                <h5>C+A Global</h5>
              </div>
              <h3>02/2026-Present</h3>
            </div>
            <p>
              Develop, test, and maintain high-quality mobile applications for iOS. Collaborate with cross-functional teams to design and deliver new features, build responsive UI components, troubleshoot, and optimize applications to ensure peak performance and scalability.
            </p>
          </div>

          <div className="career-info-box">
            <div className="career-info-in">
              <div className="career-role">
                <h4>Mobile App Development Trainee</h4>
                <h5>Live Deftsoft Informatics</h5>
              </div>
              <h3>06/2025-12/2025</h3>
            </div>
            <p>
              Gained comprehensive hands-on training in mobile app development. Developed and tested iOS mobile applications, maintained clean and well-documented code, and worked closely with senior developers to ship reliable new features following standard coding practices.
            </p>
          </div>

          <div className="career-info-box">
            <div className="career-info-in">
              <div className="career-role">
                <h4>Bachelor of Engineering (IT)</h4>
                <h5>Chandigarh University</h5>
              </div>
              <h3>08/2021-06/2025</h3>
            </div>
            <p>
              Graduated with a major in Information Technology. Focused on software engineering principles, database systems, object-oriented design, algorithm design, data structures, and foundational mobile app architectures.
            </p>
          </div>

          <div className="career-info-box">
            <div className="career-info-in">
              <div className="career-role">
                <h4>Intermediate Education</h4>
                <h5>New G.M.T Public School</h5>
              </div>
              <h3>2020-2021</h3>
            </div>
            <p>
              Completed senior secondary education under CBSE board with specialization in non-medical sciences (Physics, Chemistry, and Mathematics) at Ludhiana, Punjab, establishing analytical and technical problem-solving foundations.
            </p>
          </div>

          <div className="career-info-box">
            <div className="career-info-in">
              <div className="career-role">
                <h4>Matriculation</h4>
                <h5>New G.M.T Public School</h5>
              </div>
              <h3>2018-2019</h3>
            </div>
            <p>
              Completed secondary high-school matriculation curriculum under CBSE board at Ludhiana, Punjab, focusing on core sciences, mathematics, and communicative skills.
            </p>
          </div>

        </div>
      </div>
    </div>
  );
};

export default Career;
