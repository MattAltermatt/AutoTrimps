// Approach-B closed form. Constants mirrored from ../trimps-game (config.js:11876 job
// modifier 0.5; config.js:13075 Speedscience 1.25). A constant-parity guard (tracked in
// #46) should assert these still match the clone.
export function optimalScientistShare({
  workspaces,
  speedscienceCount = 0,
  targetScience,
  targetResource,
  resourceSplit = 3,
}) {
  const sciCoef = 0.5 * Math.pow(1.25, speedscienceCount) * workspaces
  const resCoef = (0.5 * workspaces) / resourceSplit
  const A = targetScience * resCoef
  const B = targetResource * sciCoef
  return A / (A + B)
}
