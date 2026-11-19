// Muscle groups, exercise → muscle mapping, and the body-map drawing.
// Primary muscle = 1 set credit, secondary = 0.5.

const MUSCLES = {
  chest: "Chest", frontDelts: "Front delts", sideDelts: "Side delts", rearDelts: "Rear delts",
  triceps: "Triceps", biceps: "Biceps", forearms: "Forearms",
  lats: "Lats", upperBack: "Upper back", traps: "Traps", lowerBack: "Lower back",
  abs: "Abs", obliques: "Obliques",
  quads: "Quads", hamstrings: "Hamstrings", glutes: "Glutes", calves: "Calves",
};

// Weekly set targets (a sensible middle-of-the-road range for building muscle).
const WEEKLY_TARGET = {
  chest: 10, frontDelts: 6, sideDelts: 10, rearDelts: 8, triceps: 10, biceps: 10, forearms: 6,
  lats: 10, upperBack: 10, traps: 6, lowerBack: 4, abs: 8, obliques: 4,
  quads: 10, hamstrings: 8, glutes: 8, calves: 8,
};

const EXERCISE_MUSCLES = {
  "Barbell Bench Press": { p: ["chest"], s: ["frontDelts", "triceps"] },
  "Dumbbell Chest Press": { p: ["chest"], s: ["frontDelts", "triceps"] },
  "Incline Dumbbell Press": { p: ["chest", "frontDelts"], s: ["triceps"] },
  "Incline Chest Press Machine": { p: ["chest", "frontDelts"], s: ["triceps"] },
  "Chest Fly Machine": { p: ["chest"], s: [] },
  "Push Ups": { p: ["chest"], s: ["frontDelts", "triceps", "abs"] },
  "Dumbbell Shoulder Press": { p: ["frontDelts"], s: ["sideDelts", "triceps"] },
  "Seated Shoulder Press Machine": { p: ["frontDelts"], s: ["sideDelts", "triceps"] },
  "Dumbbell Lateral Raise": { p: ["sideDelts"], s: [] },
  "Front Plate Raise": { p: ["frontDelts"], s: [] },
  "Plate Front Raise": { p: ["frontDelts"], s: [] },
  "Rear Delt Fly": { p: ["rearDelts"], s: ["upperBack"] },
  "Cable Face Pull": { p: ["rearDelts"], s: ["upperBack", "traps"] },
  "Cable Tricep Pushdown": { p: ["triceps"], s: [] },
  "EZ Bar Skull Crusher": { p: ["triceps"], s: [] },
  "Dumbbell Lying Triceps Extension": { p: ["triceps"], s: [] },
  "Dumbbell Triceps Extension": { p: ["triceps"], s: [] },
  "Dumbbell Kickback": { p: ["triceps"], s: [] },
  "Pull Ups": { p: ["lats"], s: ["upperBack", "biceps"] },
  "Neutral Grip Pull Ups": { p: ["lats"], s: ["upperBack", "biceps"] },
  "Cable Lat Pulldown": { p: ["lats"], s: ["upperBack", "biceps"] },
  "Seated Row Machine": { p: ["upperBack", "lats"], s: ["rearDelts", "biceps"] },
  "Seated Cable Rows": { p: ["upperBack", "lats"], s: ["rearDelts", "biceps"] },
  "Dumbbell Row (Chest Supported)": { p: ["upperBack", "lats"], s: ["rearDelts", "biceps"] },
  "Bent Over Dumbbell Row": { p: ["upperBack", "lats"], s: ["rearDelts", "biceps", "lowerBack"] },
  "1 arm high cable row": { p: ["upperBack"], s: ["rearDelts", "lats"] },
  "Dumbbell Shrug": { p: ["traps"], s: [] },
  "Back Extension": { p: ["lowerBack", "glutes"], s: ["hamstrings"] },
  "Dumbbell Deadlift": { p: ["glutes", "hamstrings"], s: ["lowerBack", "quads", "traps"] },
  "Incline Dumbbell Curl": { p: ["biceps"], s: ["forearms"] },
  "Dumbbell Hammer Curl": { p: ["biceps", "forearms"], s: [] },
  "Dumbbell Spider Curl": { p: ["biceps"], s: [] },
  "Dumbbell Bicep Curl": { p: ["biceps"], s: ["forearms"] },
  "Barbell Curl": { p: ["biceps"], s: ["forearms"] },
  "Barbell Spider Curls": { p: ["biceps"], s: [] },
  "Waiter Curls": { p: ["biceps"], s: ["forearms"] },
  "Dumbbell Wrist Curl": { p: ["forearms"], s: [] },
  "Barbell Squat": { p: ["quads", "glutes"], s: ["hamstrings", "lowerBack"] },
  "Body Weight Squat": { p: ["quads"], s: ["glutes"] },
  "Inclined Leg Press Machine": { p: ["quads", "glutes"], s: ["hamstrings"] },
  "Seated Leg Extension Machine": { p: ["quads"], s: [] },
  "Seated Leg Curl Machine": { p: ["hamstrings"], s: [] },
  "Dumbbell Bulgarian Split Squat": { p: ["quads", "glutes"], s: ["hamstrings"] },
  "Bulgarian Split Squat": { p: ["quads", "glutes"], s: ["hamstrings"] },
  "Calf Raise Machine": { p: ["calves"], s: [] },
  "Decline Sit Up": { p: ["abs"], s: ["obliques"] },
  "Sit Ups": { p: ["abs"], s: [] },
  "Ab Crunch Machine": { p: ["abs"], s: [] },
  "Hanging Leg Raise": { p: ["abs"], s: ["obliques"] },
  "Hanging Knee Raise": { p: ["abs"], s: ["obliques"] },
  "Reverse Crunch": { p: ["abs"], s: [] },
  "Planks": { p: ["abs"], s: ["obliques"] },
  "Side Plank": { p: ["obliques"], s: ["abs"] },
};


// ---- extended library (common gym exercises) ----
Object.assign(EXERCISE_MUSCLES, {
  // chest
  "Incline Barbell Bench Press": { p: ["chest", "frontDelts"], s: ["triceps"] },
  "Decline Bench Press": { p: ["chest"], s: ["triceps"] },
  "Close Grip Bench Press": { p: ["triceps", "chest"], s: ["frontDelts"] },
  "Dumbbell Fly": { p: ["chest"], s: ["frontDelts"] },
  "Incline Dumbbell Fly": { p: ["chest"], s: ["frontDelts"] },
  "Cable Crossover": { p: ["chest"], s: ["frontDelts"] },
  "Pec Deck": { p: ["chest"], s: [] },
  "Machine Chest Press": { p: ["chest"], s: ["frontDelts", "triceps"] },
  "Smith Machine Bench Press": { p: ["chest"], s: ["frontDelts", "triceps"] },
  "Dips": { p: ["chest", "triceps"], s: ["frontDelts"] },
  "Assisted Dips": { p: ["chest", "triceps"], s: ["frontDelts"] },
  // shoulders
  "Overhead Press": { p: ["frontDelts"], s: ["sideDelts", "triceps", "traps"] },
  "Arnold Press": { p: ["frontDelts", "sideDelts"], s: ["triceps"] },
  "Cable Lateral Raise": { p: ["sideDelts"], s: [] },
  "Machine Lateral Raise": { p: ["sideDelts"], s: [] },
  "Dumbbell Front Raise": { p: ["frontDelts"], s: [] },
  "Upright Row": { p: ["sideDelts", "traps"], s: ["biceps"] },
  "Reverse Pec Deck": { p: ["rearDelts"], s: ["upperBack"] },
  "Bent Over Rear Delt Raise": { p: ["rearDelts"], s: ["upperBack"] },
  // triceps
  "Overhead Cable Triceps Extension": { p: ["triceps"], s: [] },
  "Overhead Dumbbell Triceps Extension": { p: ["triceps"], s: [] },
  "Rope Pushdown": { p: ["triceps"], s: [] },
  "Bench Dips": { p: ["triceps"], s: ["chest", "frontDelts"] },
  // back
  "Chin Ups": { p: ["lats", "biceps"], s: ["upperBack"] },
  "Assisted Pull Ups": { p: ["lats"], s: ["upperBack", "biceps"] },
  "Close Grip Lat Pulldown": { p: ["lats"], s: ["upperBack", "biceps"] },
  "Straight Arm Pulldown": { p: ["lats"], s: [] },
  "Barbell Row": { p: ["upperBack", "lats"], s: ["rearDelts", "biceps", "lowerBack"] },
  "Pendlay Row": { p: ["upperBack", "lats"], s: ["rearDelts", "biceps", "lowerBack"] },
  "T-Bar Row": { p: ["upperBack", "lats"], s: ["rearDelts", "biceps"] },
  "Single Arm Dumbbell Row": { p: ["lats", "upperBack"], s: ["rearDelts", "biceps"] },
  "Inverted Row": { p: ["upperBack", "lats"], s: ["biceps", "rearDelts"] },
  "Barbell Shrug": { p: ["traps"], s: [] },
  "Deadlift": { p: ["glutes", "hamstrings", "lowerBack"], s: ["quads", "traps", "forearms"] },
  "Barbell Deadlift": { p: ["glutes", "hamstrings", "lowerBack"], s: ["quads", "traps", "forearms"] },
  "Trap Bar Deadlift": { p: ["quads", "glutes"], s: ["hamstrings", "lowerBack", "traps"] },
  "Romanian Deadlift": { p: ["hamstrings", "glutes"], s: ["lowerBack"] },
  "Dumbbell Romanian Deadlift": { p: ["hamstrings", "glutes"], s: ["lowerBack"] },
  "Good Morning": { p: ["hamstrings", "lowerBack"], s: ["glutes"] },
  "Hyperextension": { p: ["lowerBack", "glutes"], s: ["hamstrings"] },
  // arms
  "EZ Bar Curl": { p: ["biceps"], s: ["forearms"] },
  "Preacher Curl": { p: ["biceps"], s: [] },
  "Cable Curl": { p: ["biceps"], s: ["forearms"] },
  "Concentration Curl": { p: ["biceps"], s: [] },
  "Reverse Curl": { p: ["forearms", "biceps"], s: [] },
  "Reverse Wrist Curl": { p: ["forearms"], s: [] },
  "Farmer's Walk": { p: ["forearms", "traps"], s: ["abs", "quads"] },
  "Dead Hang": { p: ["forearms"], s: ["lats"] },
  // legs
  "Front Squat": { p: ["quads"], s: ["glutes", "abs", "upperBack"] },
  "Goblet Squat": { p: ["quads", "glutes"], s: ["abs"] },
  "Hack Squat": { p: ["quads"], s: ["glutes"] },
  "Smith Machine Squat": { p: ["quads", "glutes"], s: ["hamstrings"] },
  "Leg Press": { p: ["quads", "glutes"], s: ["hamstrings"] },
  "Walking Lunge": { p: ["quads", "glutes"], s: ["hamstrings"] },
  "Dumbbell Lunge": { p: ["quads", "glutes"], s: ["hamstrings"] },
  "Reverse Lunge": { p: ["glutes", "quads"], s: ["hamstrings"] },
  "Step Ups": { p: ["quads", "glutes"], s: ["hamstrings"] },
  "Lying Leg Curl": { p: ["hamstrings"], s: ["calves"] },
  "Nordic Curl": { p: ["hamstrings"], s: [] },
  "Hip Thrust": { p: ["glutes"], s: ["hamstrings"] },
  "Barbell Hip Thrust": { p: ["glutes"], s: ["hamstrings"] },
  "Glute Bridge": { p: ["glutes"], s: ["hamstrings"] },
  "Cable Kickback": { p: ["glutes"], s: ["hamstrings"] },
  "Hip Abduction Machine": { p: ["glutes"], s: [] },
  "Standing Calf Raise": { p: ["calves"], s: [] },
  "Seated Calf Raise": { p: ["calves"], s: [] },
  "Leg Press Calf Raise": { p: ["calves"], s: [] },
  // core
  "Crunch": { p: ["abs"], s: [] },
  "Cable Crunch": { p: ["abs"], s: [] },
  "Ab Wheel Rollout": { p: ["abs"], s: ["obliques", "lats"] },
  "Russian Twist": { p: ["obliques"], s: ["abs"] },
  "Bicycle Crunch": { p: ["abs", "obliques"], s: [] },
  "Mountain Climbers": { p: ["abs"], s: ["frontDelts", "quads"] },
  "Dead Bug": { p: ["abs"], s: [] },
  "Pallof Press": { p: ["obliques", "abs"], s: [] },
  "Cable Woodchop": { p: ["obliques"], s: ["abs"] },
  "V Ups": { p: ["abs"], s: [] },
});

// Your own exercises: tagged by you in the app, stored with your data.
function customMuscles() { return (typeof S !== "undefined" && S && S.customEx) || {}; }
function knownExercise(name) { return !!(customMuscles()[name] || EXERCISE_MUSCLES[name]); }

// Keyword fallback for exercises not in the table (e.g. ones a friend adds).
const KEYWORDS = [
  [/bench|chest|fly|push ?up|\bdips?\b/i, { p: ["chest"], s: ["triceps", "frontDelts"] }],
  [/lateral/i, { p: ["sideDelts"], s: [] }],
  [/rear delt|reverse fly|face pull/i, { p: ["rearDelts"], s: ["upperBack"] }],
  [/shoulder|overhead press|military/i, { p: ["frontDelts"], s: ["sideDelts", "triceps"] }],
  [/tricep|skull|kickback|pushdown/i, { p: ["triceps"], s: [] }],
  [/wrist/i, { p: ["forearms"], s: [] }],
  [/curl/i, { p: ["biceps"], s: ["forearms"] }],
  [/pull ?up|\bchin|pulldown/i, { p: ["lats"], s: ["biceps", "upperBack"] }],
  [/row/i, { p: ["upperBack", "lats"], s: ["biceps", "rearDelts"] }],
  [/shrug/i, { p: ["traps"], s: [] }],
  [/deadlift|rdl|good morning|hip thrust/i, { p: ["glutes", "hamstrings"], s: ["lowerBack"] }],
  [/leg curl|hamstring/i, { p: ["hamstrings"], s: [] }],
  [/squat|lunge|leg press|extension machine|step ?up/i, { p: ["quads", "glutes"], s: [] }],
  [/calf/i, { p: ["calves"], s: [] }],
  [/side plank|oblique|twist|woodchop/i, { p: ["obliques"], s: ["abs"] }],
  [/crunch|sit ?up|plank|leg raise|ab /i, { p: ["abs"], s: [] }],
  [/back extension|hyperextension/i, { p: ["lowerBack", "glutes"], s: ["hamstrings"] }],
];

function musclesFor(name) {
  const c = customMuscles()[name]; if (c) return c;
  if (EXERCISE_MUSCLES[name]) return EXERCISE_MUSCLES[name];
  for (const [re, m] of KEYWORDS) if (re.test(name)) return m;
  return { p: [], s: [] };
}

// Exercises logged against bodyweight (Arrow stores bodyweight in the weight field).
const BODYWEIGHT = /\b(pull ?ups?|chin ?ups?|push ?ups?|sit ?ups?|leg raises?|knee raises?|planks?|reverse crunch|body ?weight|dips?)\b/i;

// Exercises usually done one side at a time (reps are logged per side).
const UNILATERAL = /bulgarian|split squat|lunge|single[- ]?(arm|leg)|one[- ]?arm|1[- ]?arm|kickback|concentration|step ?up|pistol/i;
// Big multi-joint lifts get the longer rest timer.
const COMPOUND = /squat|bench|press|row|pull ?ups?|pulldown|deadlift|lunge|dips?\b|chin|hip thrust|back extension/i;

// Muscle groups for the balance radar and distribution charts.
const GROUPS = {
  Chest: ["chest"],
  Back: ["lats", "upperBack", "traps", "lowerBack"],
  Shoulders: ["frontDelts", "sideDelts", "rearDelts"],
  Arms: ["biceps", "triceps", "forearms"],
  Legs: ["quads", "hamstrings", "glutes", "calves"],
  Core: ["abs", "obliques"],
};

// ---- Strength standards ----
// Thresholds (estimated 1RM ÷ bodyweight) where Novice, Intermediate, Advanced and Elite begin.
// Approximate consensus of public bodyweight-ratio tables (sources disagree a little); use as a rough guide, not a ranking.
// "reps" standards are max reps in one set (bodyweight moves). Dumbbell numbers are per dumbbell.
const STANDARDS = {
  "Barbell Squat":        { m: [1.0, 1.5, 2.0, 2.5],   f: [0.75, 1.25, 1.5, 2.0] },
  "Front Squat":          { m: [0.8, 1.2, 1.6, 2.0],   f: [0.6, 1.0, 1.25, 1.6] },
  "Barbell Bench Press":  { m: [0.75, 1.0, 1.5, 2.0],  f: [0.5, 0.75, 1.0, 1.25] },
  "Incline Barbell Bench Press": { m: [0.6, 0.85, 1.2, 1.6], f: [0.4, 0.6, 0.85, 1.1] },
  "Deadlift":             { m: [1.25, 2.0, 2.5, 3.0],  f: [1.0, 1.5, 2.0, 2.5] },
  "Barbell Deadlift":     { m: [1.25, 2.0, 2.5, 3.0],  f: [1.0, 1.5, 2.0, 2.5] },
  "Romanian Deadlift":    { m: [1.0, 1.5, 2.0, 2.5],   f: [0.75, 1.1, 1.5, 1.9] },
  "Overhead Press":       { m: [0.5, 0.65, 0.9, 1.15], f: [0.35, 0.5, 0.65, 0.8] },
  "Barbell Row":          { m: [0.6, 0.9, 1.2, 1.5],   f: [0.4, 0.6, 0.8, 1.0] },
  "Inclined Leg Press Machine": { m: [1.5, 2.5, 3.5, 4.5], f: [1.0, 1.75, 2.5, 3.5] },
  "Leg Press":            { m: [1.5, 2.5, 3.5, 4.5],   f: [1.0, 1.75, 2.5, 3.5] },
  "Dumbbell Chest Press": { m: [0.25, 0.4, 0.55, 0.75], f: [0.15, 0.25, 0.35, 0.5] },
  "Incline Dumbbell Press": { m: [0.22, 0.35, 0.5, 0.68], f: [0.13, 0.22, 0.32, 0.45] },
  "Dumbbell Shoulder Press": { m: [0.18, 0.3, 0.42, 0.55], f: [0.1, 0.18, 0.27, 0.36] },
  "Dumbbell Bicep Curl":  { m: [0.15, 0.25, 0.35, 0.45], f: [0.08, 0.14, 0.2, 0.28] },
  "Dumbbell Hammer Curl": { m: [0.15, 0.25, 0.35, 0.45], f: [0.08, 0.14, 0.2, 0.28] },
  "Dumbbell Lateral Raise": { m: [0.08, 0.13, 0.2, 0.27], f: [0.05, 0.08, 0.12, 0.17] },
  "Cable Lat Pulldown":   { m: [0.6, 0.85, 1.1, 1.4],  f: [0.4, 0.55, 0.75, 0.95] },
  "Pull Ups":             { reps: { m: [3, 8, 15, 22], f: [1, 3, 8, 15] } },
  "Chin Ups":             { reps: { m: [3, 9, 16, 24], f: [1, 4, 9, 16] } },
  "Push Ups":             { reps: { m: [10, 25, 40, 60], f: [3, 12, 25, 40] } },
  "Dips":                 { reps: { m: [5, 12, 22, 32], f: [1, 5, 12, 20] } },
};
const LEVELS = ["Beginner", "Novice", "Intermediate", "Advanced", "Elite"];
