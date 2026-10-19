import { M, P, Q, quiz, R, V, type DemoEducator } from "./types.js";

/** Skills: practical and vocational learning for everyday people. */
export const SKILLS_EDUCATORS: DemoEducator[] = [
  {
    key: "skillshub",
    name: "Sarah Nabirye",
    email: "sarah.nabirye@demo.peebee.invalid",
    phone: "+256000100004",
    school: {
      name: "Kampala Skills Hub",
      slug: "demo-kampala-skills-hub",
      kind: "training_centre",
      streams: ["skills"],
      tagline: "Learn a trade. Earn a living.",
      bio: "A hands-on training centre in Kampala teaching tailoring, phone repair and baking. Short courses, small workshops and a tutor for every trade.",
      location: "Kampala",
      motto: "Skills that pay",
      badge: "KSH",
    },
    classes: [
      {
        key: "tailoring",
        stream: "skills",
        kind: "class",
        name: "Tailoring and Fashion",
        level: "Beginner workshop",
        framework: "uvqf_tvet",
        term: "Rolling intake",
        tutor: "Mama Sarah Nabirye",
        capacity: 20,
        summary: "Measure, cut and sew a simple garment.",
        courses: [
          {
            key: "tailoring",
            title: "Tailoring Basics",
            summary: "Take body measurements, read a simple pattern, cut cloth and sew a straight skirt from start to finish.",
            outcomes: ["Take accurate body measurements", "Cut cloth along a pattern", "Sew a straight seam and a hem"],
            modules: [
              M(
                "Measuring and cutting",
                "Good garments start with good measurements.",
                V("Taking measurements", "Measure over thin clothing with the tape snug but not tight. Record bust, waist, hip, shoulder and length, and write each number down at once. Measure twice, cut once.", {
                  minutes: 10,
                  quiz: quiz("Measuring", Q("Why measure twice before cutting?", ["Cloth cannot be un-cut", "It is faster", "The tape stretches"], 0), Q("Where should the tape measure sit?", ["Snug, not tight", "Very loose", "Pulled hard"], 0)),
                }),
                P("Cutting from a pattern", "Pin the pattern on the folded cloth along the grain line. Add 1.5 cm for seams. Cut with long, smooth strokes of sharp scissors and never use the scissors for paper.", { minutes: 20 }),
              ),
              M(
                "Sewing",
                "Seams, hems and a finished skirt.",
                V("Straight seams", "Place two pieces with the right sides together. Sew a straight line 1.5 cm from the edge, reversing at both ends to lock the stitches. Press the seam open with a warm iron.", {
                  minutes: 12,
                  quiz: quiz("Seams", Q("Before sewing a seam, the right sides of the cloth should be...", ["Together", "Facing out", "Folded in four"], 0)),
                }),
                P("Make a straight skirt", "Join the side seams, attach a waistband and finish with a hem. Try it on and check that you can sit and walk comfortably. Note one thing you would change next time.", { minutes: 45 }),
              ),
            ],
          },
        ],
      },
      {
        key: "phones",
        stream: "skills",
        kind: "class",
        name: "Phone and Electronics Repair",
        level: "Beginner workshop",
        framework: "uvqf_tvet",
        term: "Rolling intake",
        tutor: "Mr. Moses Ogwal",
        capacity: 16,
        summary: "Find faults and fix the most common phone problems.",
        courses: [
          {
            key: "phonerepair",
            title: "Smartphone Repair Fundamentals",
            summary: "Work safely, diagnose common faults and replace screens and batteries.",
            outcomes: ["Work safely with tools and batteries", "Diagnose a no-charge or no-display fault", "Replace a screen and a battery"],
            modules: [
              M(
                "Safe working",
                "Before you open any phone.",
                V("Tools and safety", "Use a clean, well-lit bench, an anti-static mat and the right screwdrivers. Switch the phone off and remove the battery connection first. A swollen battery must never be pierced or pressed: put it in a safe place and dispose of it properly.", {
                  minutes: 10,
                  quiz: quiz("Safety", Q("The first step before opening a phone is to...", ["Switch it off and disconnect the battery", "Press the screen", "Charge it fully"], 0), Q("A swollen battery should be...", ["Handled very carefully and disposed of safely", "Pressed flat", "Pierced to release gas"], 0)),
                }),
                R("Diagnosing faults", "Ask the owner what happened. Check the charger and cable before blaming the phone, look in the charging port for lint, and try a known good battery or charger. Most problems have simple causes.", { minutes: 8 }),
              ),
              M(
                "Common repairs",
                "The two jobs customers ask for most.",
                V("Replacing a screen", "Warm the edge to soften the glue, lift with a thin pick, disconnect the display cable, fit the new screen and test before sealing. Keep screws in order on a labelled tray.", {
                  minutes: 14,
                  quiz: quiz("Screens", Q("Test the new screen...", ["Before sealing the phone", "Only after sealing", "Never"], 0)),
                }),
                P("Replace a battery", "Disconnect the old battery, release the adhesive tabs slowly, fit the new battery, reconnect and power up. Record the date and the part used for the customer's warranty note.", { minutes: 25 }),
              ),
            ],
          },
        ],
      },
      {
        key: "baking",
        stream: "skills",
        kind: "class",
        name: "Baking and Catering",
        level: "Beginner workshop",
        framework: "uvqf_tvet",
        term: "Rolling intake",
        tutor: "Ms. Mary Auma",
        capacity: 20,
        summary: "Bread, buns and cakes for home and for sale.",
        courses: [
          {
            key: "baking",
            title: "Baking Basics: Bread and Cakes",
            summary: "Mix, rise and bake a soft loaf and a simple sponge cake, then cost them so you can sell them.",
            outcomes: ["Mix and knead a bread dough", "Bake a sponge cake that rises evenly", "Cost a bake to set a price"],
            modules: [
              M(
                "Bread",
                "Flour, water, yeast and patience.",
                V("Mixing and kneading", "Mix flour, a pinch of salt, sugar and yeast with warm (not hot) water. Knead for ten minutes until the dough is smooth and springs back when pressed. Let it rise in a warm place until it doubles.", {
                  minutes: 12,
                  quiz: quiz("Bread", Q("Water for yeast should be...", ["Warm, not hot", "Boiling", "Ice cold"], 0, "Hot water kills yeast, so the dough will not rise."), Q("Dough is ready to bake when it has...", ["Doubled in size", "Turned brown", "Dried out"], 0)),
                }),
                P("Shape and bake", "Shape into a loaf or buns, rest for 20 minutes and bake at 200 degrees until golden. A hollow sound when you tap the base means it is cooked.", { minutes: 40 }),
              ),
              M(
                "Cakes and costing",
                "From the oven to a fair price.",
                V("A simple sponge", "Cream equal weights of butter and sugar until pale, beat in eggs one at a time, then fold in flour. Do not open the oven in the first twenty minutes or the cake may sink.", { minutes: 12 }),
                R("Cost it to sell it", "Add the cost of every ingredient, plus gas or charcoal and packaging, and divide by the number of slices. Then add your profit, usually 30 to 50 percent. Never guess a price.", {
                  minutes: 8,
                  quiz: quiz("Costing", Q("A cake costs 20,000 to make and gives 10 slices. The cost per slice is...", ["2,000", "200", "20,000"], 0)),
                }),
              ),
            ],
          },
        ],
      },
    ],
  },
  {
    key: "ibrahim",
    name: "Ibrahim Wasswa",
    email: "ibrahim.wasswa@demo.peebee.invalid",
    phone: "+256000100007",
    school: {
      name: "Ibrahim Wasswa: Motorcycle Repair",
      slug: "demo-ibrahim-motorcycle-repair",
      kind: "independent_tutor",
      streams: ["skills"],
      tagline: "Keep boda bodas on the road",
      bio: "Ibrahim has repaired motorcycles for fifteen years and runs his own garage in Mbale. He teaches riders and apprentices how to look after a motorcycle and spot problems early.",
      location: "Mbale (online lessons)",
      motto: "A good mechanic listens first",
      badge: "IWM",
    },
    classes: [
      {
        key: "moto",
        stream: "skills",
        kind: "class",
        name: "Motorcycle Maintenance Workshop",
        level: "Riders and apprentices",
        framework: "uvqf_tvet",
        term: "Open enrolment",
        tutor: "Ibrahim Wasswa",
        capacity: 25,
        summary: "Daily checks and basic servicing for motorcycles.",
        courses: [
          {
            key: "motorcycle",
            title: "Motorcycle Maintenance Basics",
            summary: "Carry out the daily safety check, change oil, look after the chain and brakes, and find faults early.",
            outcomes: ["Do a five-minute daily check", "Change engine oil and the oil filter", "Adjust and lubricate a chain"],
            modules: [
              M(
                "Daily care",
                "Small checks that prevent big repairs.",
                V("The five-minute check", "Before every ride check tyres (pressure and cracks), brakes (lever travel), chain (slack and lubrication), lights and horn, and oil level. Make it a habit, like locking your door.", {
                  minutes: 9,
                  quiz: quiz("Daily check", Q("Which of these belongs in a daily check?", ["Tyres, brakes, chain, lights, oil", "Only the paint", "Only the seat"], 0), Q("A chain that is too loose should be...", ["Adjusted", "Ignored", "Removed"], 0)),
                }),
                P("Chain care", "Clean the chain with a brush and kerosene, dry it, then apply chain lubricant while turning the wheel slowly. Check slack: about 2 to 3 cm of movement mid-way between the sprockets.", { minutes: 20 }),
              ),
              M(
                "Servicing",
                "Oil, filters and brakes.",
                V("Changing the oil", "Warm the engine for two minutes, place a tray under the drain bolt, drain, replace the washer, tighten and refill to the mark on the dipstick. Never mix old and new oil by topping up for months.", {
                  minutes: 11,
                  quiz: quiz("Oil", Q("Used oil should be...", ["Collected and disposed of safely", "Poured on the road", "Poured down a drain"], 0)),
                }),
                R("Brake pads", "If the brake lever pulls close to the handle or you hear metal grinding, the pads are worn. Replace the pads in pairs and test the brakes slowly before riding in traffic.", { minutes: 7 }),
              ),
            ],
          },
        ],
      },
    ],
  },
];
