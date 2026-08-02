export type PasswordRequirement = {
  id: "length" | "uppercase" | "lowercase" | "number";
  label: string;
  test: (value: string) => boolean;
};

export const PASSWORD_REQUIREMENTS: PasswordRequirement[] = [
  {
    id: "length",
    label: "Mindst 10 tegn",
    test: (value) => value.length >= 10
  },
  {
    id: "uppercase",
    label: "Mindst ét stort bogstav",
    test: (value) => /[A-ZÆØÅ]/.test(value)
  },
  {
    id: "lowercase",
    label: "Mindst ét lille bogstav",
    test: (value) => /[a-zæøå]/.test(value)
  },
  {
    id: "number",
    label: "Mindst ét tal",
    test: (value) => /[0-9]/.test(value)
  }
];

export function evaluatePasswordRequirements(value: string) {
  return PASSWORD_REQUIREMENTS.map((requirement) => ({
    id: requirement.id,
    label: requirement.label,
    met: requirement.test(value)
  }));
}

export function passwordMeetsRequirements(value: string) {
  return PASSWORD_REQUIREMENTS.every((requirement) => requirement.test(value));
}
