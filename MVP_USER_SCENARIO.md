# MVP User Scenarios: Interview Prep Tool

## The MVP Goal
To allow a job seeker to quickly get relevant practice questions based strictly on the job they are applying for.

## Scenarios

### Scenario 1: Inputting the Job Context
* **As a** job seeker, 
* **I want to** paste a specific job description into a text box, 
* **So that** the system understands the exact skills and requirements of the role I am targeting.
* **Acceptance Criteria:** * The system accepts up to 5,000 characters of text. 
  * If the text box is empty when submitted, the user sees an error message prompting them to add the description.

### Scenario 2: Generating the Core Value (The Output)
* **As a** job seeker,
* **I want to** click a `Generate Questions` button and receive a list of 5 to 10 tailored interview questions,
* **So that** I can start practicing immediately without having to guess what they might ask.
* **Acceptance Criteria:** * The system returns a mix of technical and behavioral questions derived directly from the keywords in the pasted job description within 15 seconds.

### Scenario 3: Basic Content Management
* **As a** job seeker,
* **I want to** copy the generated list of questions to my clipboard with one click,
* **So that** I can paste them into my own notes document to practice offline.
* **Acceptance Criteria:** * A `Copy All` button exists that successfully copies the formatted text.

### Scenario 4: Aligning with Company Culture
* **As a** job seeker, 
* **I want to** input the target company's name alongside the job description, 
* **So that** the generated behavioral questions test my fit for their specific corporate culture and values.
* **Acceptance Criteria:** * The system provides an optional `Company Name` input field. 
  * If filled, the AI references its general knowledge of that organization to ensure at least 2 of the generated questions reflect their known core values or typical culture-fit assessments.


### Scenario 5: Incorporating Recent Company Projects
* **As a** job seeker, 
* **I want to** paste text from a recent company blog post or engineering article into a `Recent Projects` field, 
* **So that** the AI can generate advanced questions that test my ability to contribute to their current technical initiatives.
* **Acceptance Criteria:** * The system provides an optional `Company Context / Blog Text` input field (accepting up to 5,000 characters). 
  * If populated, the system cross-references this text with the job description. 
  * At least 1-2 generated questions require the user to apply the job's required skills to the specific project mentioned (e.g., if the job requires database scaling and the pasted blog discusses transitioning to a multi-tenant architecture or implementing semantic search, the AI generates a scenario-based question bridging the two).