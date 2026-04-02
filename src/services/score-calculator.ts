import type { ParityGrade } from "../types/parity";

export function getGrade(score: number): ParityGrade {
  if (score >= 90) return "Excellent";
  if (score >= 75) return "Good";
  if (score >= 60) return "Fair";
  if (score >= 40) return "Poor";
  return "Critical";
}

export function formatScore(score: number): string {
  return `${score} · ${getGrade(score)}`;
}

export function getGradeColor(grade: ParityGrade): string {
  switch (grade) {
    case "Excellent":
      return "text-green-700 bg-green-50 border-green-200";
    case "Good":
      return "text-blue-700 bg-blue-50 border-blue-200";
    case "Fair":
      return "text-amber-700 bg-amber-50 border-amber-200";
    case "Poor":
      return "text-orange-700 bg-orange-50 border-orange-200";
    case "Critical":
      return "text-red-700 bg-red-50 border-red-200";
  }
}

export function getGradeDot(grade: ParityGrade): string {
  switch (grade) {
    case "Excellent":
      return "bg-green-400";
    case "Good":
      return "bg-blue-400";
    case "Fair":
      return "bg-amber-400";
    case "Poor":
      return "bg-orange-400";
    case "Critical":
      return "bg-red-400";
  }
}

export function averageScores(scores: number[]): number {
  if (scores.length === 0) return 0;
  return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
}
