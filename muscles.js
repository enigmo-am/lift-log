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
