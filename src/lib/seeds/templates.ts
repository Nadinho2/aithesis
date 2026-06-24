export interface ChapterTemplate {
  order: number;
  title: string;
  sections: string[];
}

export interface UniversityTemplate {
  short_name: string;
  referencing_style: string;
  font_style: string;
  font_size: number;
  line_spacing: string;
  thesis_chapters: ChapterTemplate[];
  proposal_chapters: ChapterTemplate[];
}

// ─── Pattern A: Standard Social Sciences / Sciences ───

const PATTERN_A_THESIS: ChapterTemplate[] = [
  { order: 1, title: "Chapter One: Introduction", sections: ["Background to the Study", "Statement of the Problem", "Objectives of the Study", "Research Questions", "Research Hypotheses", "Significance of the Study", "Scope and Delimitation of the Study", "Definition of Terms"] },
  { order: 2, title: "Chapter Two: Review of Related Literature", sections: ["Conceptual Framework", "Theoretical Framework", "Empirical Review", "Gap in Literature"] },
  { order: 3, title: "Chapter Three: Research Methodology", sections: ["Research Design", "Area of Study", "Population of the Study", "Sample and Sampling Technique", "Instrument for Data Collection", "Validity of the Instrument", "Reliability of the Instrument", "Method of Data Collection", "Method of Data Analysis"] },
  { order: 4, title: "Chapter Four: Data Presentation and Analysis", sections: ["Introduction", "Data Presentation", "Testing of Hypotheses", "Discussion of Findings"] },
  { order: 5, title: "Chapter Five: Summary, Conclusion and Recommendations", sections: ["Summary of Findings", "Conclusion", "Recommendations", "Suggestions for Further Studies"] },
];

const PATTERN_A_PROPOSAL: ChapterTemplate[] = PATTERN_A_THESIS.slice(0, 3);

// ─── Pattern B: OAU / UI / UNIBEN ───

const PATTERN_B_THESIS: ChapterTemplate[] = [
  { order: 1, title: "Chapter One: Introduction", sections: ["Background to the Study", "Statement of the Problem", "Objectives of the Study", "Research Questions", "Research Hypotheses", "Justification for the Study", "Scope of the Study", "Limitations of the Study", "Definition of Terms"] },
  { order: 2, title: "Chapter Two: Literature Review", sections: ["Introduction", "Conceptual Review", "Theoretical Review", "Empirical Review", "Appraisal of Reviewed Literature"] },
  { order: 3, title: "Chapter Three: Research Methodology", sections: ["Introduction", "Research Design", "Study Area", "Population of the Study", "Sampling Technique and Sample Size", "Research Instrument", "Validity and Reliability of Instrument", "Procedure for Data Collection", "Method of Data Analysis"] },
  { order: 4, title: "Chapter Four: Results and Discussion", sections: ["Introduction", "Results", "Discussion of Results"] },
  { order: 5, title: "Chapter Five: Summary, Conclusion and Recommendations", sections: ["Summary", "Conclusion", "Recommendations", "Contributions to Knowledge", "Suggestions for Further Research"] },
];

const PATTERN_B_PROPOSAL: ChapterTemplate[] = PATTERN_B_THESIS.filter((c) => c.order <= 3);

// ─── Pattern C: Engineering / Technology ───

const PATTERN_C_THESIS: ChapterTemplate[] = [
  { order: 1, title: "Chapter One: Introduction", sections: ["Background of the Study", "Statement of the Problem", "Aim and Objectives of the Study", "Motivation for the Study", "Scope of the Work", "Organisation of the Thesis"] },
  { order: 2, title: "Chapter Two: Literature Review", sections: ["Introduction", "Related Works", "Review of Existing Systems", "Limitations of Existing Systems", "Summary of Literature Review"] },
  { order: 3, title: "Chapter Three: System Analysis and Design", sections: ["Introduction", "System Analysis", "Functional Requirements", "Non-Functional Requirements", "System Design", "System Architecture", "Database Design", "Tools and Technologies Used"] },
  { order: 4, title: "Chapter Four: Implementation and Testing", sections: ["Introduction", "System Implementation", "System Testing", "Test Cases and Results", "Discussion of Results"] },
  { order: 5, title: "Chapter Five: Summary, Conclusion and Recommendations", sections: ["Summary of Work Done", "Conclusion", "Recommendations", "Future Work"] },
];

const PATTERN_C_PROPOSAL: ChapterTemplate[] = PATTERN_C_THESIS.slice(0, 3);

// ─── Pattern D: Private Universities ───

const PATTERN_D_THESIS: ChapterTemplate[] = [
  { order: 1, title: "Chapter One: Introduction", sections: ["Background to the Study", "Statement of the Problem", "Purpose of the Study", "Research Questions", "Research Hypotheses", "Significance of the Study", "Scope and Delimitations", "Definition of Terms"] },
  { order: 2, title: "Chapter Two: Review of Literature", sections: ["Introduction", "Theoretical Framework", "Conceptual Framework", "Review of Related Literature", "Summary of Literature Review"] },
  { order: 3, title: "Chapter Three: Research Methodology", sections: ["Introduction", "Research Design", "Population and Sample", "Sampling Procedure", "Research Instrument", "Validity of Instrument", "Reliability of Instrument", "Data Collection Procedure", "Data Analysis Procedure"] },
  { order: 4, title: "Chapter Four: Results and Discussion", sections: ["Introduction", "Demographic Data of Respondents", "Results", "Discussion of Findings"] },
  { order: 5, title: "Chapter Five: Summary, Conclusions and Recommendations", sections: ["Introduction", "Summary of Findings", "Conclusions", "Recommendations", "Suggestions for Further Research"] },
];

const PATTERN_D_PROPOSAL: ChapterTemplate[] = PATTERN_D_THESIS.slice(0, 3);

// ─── MOUAU Pattern ───

const MOUAU_THESIS: ChapterTemplate[] = [
  { order: 1, title: "Chapter One: Introduction", sections: ["Background to the Study", "Statement of the Problem", "Objectives of the Study", "Research Questions", "Research Hypotheses", "Significance of the Study", "Scope of the Research", "Definition of Operational Terms"] },
  { order: 2, title: "Chapter Two: Review of Related Literature", sections: ["Conceptual Review", "Conceptual Framework", "Theoretical Review", "Theoretical Framework", "Empirical Studies", "Gap in Literature"] },
  { order: 3, title: "Chapter Three: Methodology", sections: ["Research Design", "Study Area", "Population of the Study", "Sample Size Determination", "Instrument for Data Collection", "Validity of the Instrument", "Reliability of the Instrument", "Method of Data Collection", "Method of Data Analysis"] },
  { order: 4, title: "Chapter Four: Data Presentation and Analysis", sections: ["Introduction", "Data Presentation", "Testing of Hypotheses", "Discussion of Findings"] },
  { order: 5, title: "Chapter Five: Summary, Conclusion and Recommendations", sections: ["Summary of Findings", "Conclusion", "Recommendations", "Contributions to Knowledge", "Suggestions for Further Studies"] },
];

const MOUAU_PROPOSAL: ChapterTemplate[] = MOUAU_THESIS.slice(0, 3);

// ─── University Pattern Map ───

export const universityPatternMap: Record<string, string> = {
  UNILAG: "A",
  UNN: "A",
  UNIZIK: "A",
  LASU: "A",
  IMSU: "A",
  ESUT: "A",
  COOU: "A",
  RSU: "A",
  UNIPORT: "A",
  UNILORIN: "A",
  ABU: "A",
  OAU: "B",
  UI: "B",
  UNIBEN: "B",
  FUTO: "C",
  FUTA: "C",
  LASUSTECH: "C",
  Covenant: "D",
  Babcock: "D",
  "Pan-Atlantic": "D",
  MOUAU: "MOUAU",
};

// ─── Engineering override departments ───
export const engineeringDepartments = [
  "Electrical Engineering",
  "Civil Engineering",
  "Mechanical Engineering",
  "Chemical Engineering",
  "Computer Engineering",
];

// ─── Full templates map ───

export function getTemplate(pattern: string): UniversityTemplate {
  switch (pattern) {
    case "A":
      return {
        short_name: "",
        referencing_style: "apa",
        font_style: "Times New Roman",
        font_size: 12,
        line_spacing: "1.5",
        thesis_chapters: PATTERN_A_THESIS,
        proposal_chapters: PATTERN_A_PROPOSAL,
      };
    case "B":
      return {
        short_name: "",
        referencing_style: "apa",
        font_style: "Times New Roman",
        font_size: 12,
        line_spacing: "2.0",
        thesis_chapters: PATTERN_B_THESIS,
        proposal_chapters: PATTERN_B_PROPOSAL,
      };
    case "C":
      return {
        short_name: "",
        referencing_style: "ieee",
        font_style: "Times New Roman",
        font_size: 12,
        line_spacing: "1.5",
        thesis_chapters: PATTERN_C_THESIS,
        proposal_chapters: PATTERN_C_PROPOSAL,
      };
    case "D":
      return {
        short_name: "",
        referencing_style: "apa",
        font_style: "Arial",
        font_size: 12,
        line_spacing: "2.0",
        thesis_chapters: PATTERN_D_THESIS,
        proposal_chapters: PATTERN_D_PROPOSAL,
      };
    case "MOUAU":
      return {
        short_name: "",
        referencing_style: "apa",
        font_style: "Times New Roman",
        font_size: 12,
        line_spacing: "1.5",
        thesis_chapters: MOUAU_THESIS,
        proposal_chapters: MOUAU_PROPOSAL,
      };
    default:
      // Fallback to Pattern A
      return {
        short_name: "",
        referencing_style: "apa",
        font_style: "Times New Roman",
        font_size: 12,
        line_spacing: "1.5",
        thesis_chapters: PATTERN_A_THESIS,
        proposal_chapters: PATTERN_A_PROPOSAL,
      };
  }
}
