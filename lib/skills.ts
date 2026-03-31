export const SKILLS = {
  GRADE_DISSERTATIVE: "001",
  GRADE_OBJECTIVE:    "002",
  PERSONALIZED_FEEDBACK: "003",
  PLAGIARISM_CHECK:   "004",
  INGEST_DOCS:        "005",
  CLASS_SUMMARY:      "006",
  EXTRACT_WORK:       "007",
  CRUD_AI:            "008",
} as const;

export type SkillId = typeof SKILLS[keyof typeof SKILLS];
