export interface UniversitySeed {
  name: string;
  short_name: string;
  state: string;
}

export const universities: UniversitySeed[] = [
  // --- Pattern A: Standard Social Sciences / Sciences ---
  { name: "University of Lagos", short_name: "UNILAG", state: "Lagos" },
  { name: "University of Nigeria, Nsukka", short_name: "UNN", state: "Enugu" },
  { name: "Nnamdi Azikiwe University, Awka", short_name: "UNIZIK", state: "Anambra" },
  { name: "Lagos State University", short_name: "LASU", state: "Lagos" },
  { name: "Imo State University", short_name: "IMSU", state: "Imo" },
  { name: "Enugu State University of Science and Technology", short_name: "ESUT", state: "Enugu" },
  { name: "Chukwuemeka Odumegwu Ojukwu University", short_name: "COOU", state: "Anambra" },
  { name: "Rivers State University", short_name: "RSU", state: "Rivers" },
  { name: "University of Port Harcourt", short_name: "UNIPORT", state: "Rivers" },
  { name: "University of Ilorin", short_name: "UNILORIN", state: "Kwara" },
  { name: "Ahmadu Bello University, Zaria", short_name: "ABU", state: "Kaduna" },

  // --- Pattern B: OAU / UI / UNIBEN ---
  { name: "Obafemi Awolowo University", short_name: "OAU", state: "Osun" },
  { name: "University of Ibadan", short_name: "UI", state: "Oyo" },
  { name: "University of Benin", short_name: "UNIBEN", state: "Edo" },

  // --- Pattern C: Engineering / Technology ---
  { name: "Federal University of Technology, Owerri", short_name: "FUTO", state: "Imo" },
  { name: "Federal University of Technology, Akure", short_name: "FUTA", state: "Ondo" },
  { name: "Lagos State University of Science and Technology", short_name: "LASUSTECH", state: "Lagos" },

  // --- Pattern D: Private Universities ---
  { name: "Covenant University", short_name: "Covenant", state: "Ogun" },
  { name: "Babcock University", short_name: "Babcock", state: "Ogun" },
  { name: "Pan-Atlantic University", short_name: "Pan-Atlantic", state: "Lagos" },

  // --- MOUAU ---
  { name: "Michael Okpara University of Agriculture, Umudike", short_name: "MOUAU", state: "Abia" },
];
