import { M, P, Q, quiz, R, V, type DemoEducator } from "./types.js";

/** Sprouts (ages 3-6) and Foundations (primary): a nursery and primary school with several classes and tutors, and two individual tutors. */
export const EARLY_EDUCATORS: DemoEducator[] = [
  {
    key: "hilltop",
    name: "Grace Nakato",
    email: "grace.nakato@demo.peebee.invalid",
    phone: "+256000100001",
    school: {
      name: "Hilltop Junior Academy",
      slug: "demo-hilltop-junior-academy",
      kind: "school",
      streams: ["sprouts", "foundations"],
      tagline: "Nursery and primary school on the hill",
      bio: "A friendly day school in Kampala with a nursery section and a primary section. Small classes, a tutor who knows every child, and lessons that mix play with real learning.",
      location: "Kampala",
      motto: "Little steps, big minds",
      badge: "HJA",
    },
    classes: [
      {
        key: "nursery",
        stream: "sprouts",
        kind: "class",
        name: "Sunshine Nursery",
        level: "Nursery, ages 3 to 5",
        framework: "uganda_ecd",
        term: "Term 1",
        tutor: "Ms. Joan Atim",
        capacity: 25,
        summary: "Letters, numbers and stories through songs and play.",
        courses: [
          {
            key: "letters",
            title: "Letters, Sounds & Stories",
            summary: "Meet the letters A to J, hear their sounds and enjoy short stories together with a grown-up.",
            outcomes: ["Say the sounds of the letters A to J", "Match letters to pictures", "Listen to a short story and answer simple questions"],
            modules: [
              M(
                "Meet the letters",
                "The first ten letters of the alphabet.",
                V("Letters A, B and C", "Say the sound, not just the name: A says 'a' like apple, B says 'b' like ball, C says 'k' like cat. Trace each letter in the air with your finger, then in sand or on paper.", {
                  minutes: 6,
                  quiz: quiz("Letters A, B and C", Q("Which letter makes the 'b' sound in ball?", ["A", "B", "C"], 1), Q("Which picture starts with C?", ["Apple", "Ball", "Cat"], 2)),
                }),
                R("Letters D to J", "Learn two letters a day: D (dog), E (egg), F (fish), G (goat), H (hat), I (insect), J (jug). Ask the child to find each letter on a poster, a book or a sign.", { minutes: 8 }),
              ),
              M(
                "Story time",
                "Listening, remembering and talking about a story.",
                V("The Hare and the Tortoise", "A tortoise and a hare race to the big tree. The hare runs fast and then naps; the tortoise keeps walking slowly and wins. Talk about it: Why did the tortoise win? What would you do?", {
                  minutes: 7,
                  quiz: quiz("The Hare and the Tortoise", Q("Who won the race?", ["The hare", "The tortoise"], 1, "The tortoise never stopped, so he got to the tree first."), Q("What did the hare do in the middle of the race?", ["Had a nap", "Ate lunch", "Sang a song"], 0)),
                }),
                R("Retell it with puppets", "Make two puppets from socks or paper. Let the child tell the story in their own words. There are no wrong versions; you are practising memory and speaking.", { minutes: 10 }),
              ),
            ],
          },
        ],
      },
      {
        key: "reception",
        stream: "sprouts",
        kind: "class",
        name: "Reception Rainbows",
        level: "Reception, ages 4 to 6",
        framework: "uganda_ecd",
        term: "Term 1",
        tutor: "Mr. Isaac Opio",
        capacity: 25,
        summary: "Colours, shapes and counting, taught with songs and movement.",
        courses: [
          {
            key: "colours",
            title: "Colours, Shapes & Counting",
            summary: "Name the colours, spot circles, squares and triangles, and count from one to ten.",
            outcomes: ["Name six colours", "Find circles, squares and triangles around the home", "Count objects up to ten"],
            modules: [
              M(
                "Colours and shapes",
                "Looking carefully at the world around us.",
                V("The colour hunt", "Choose a colour and find five things of that colour: red tomatoes, a green leaf, a yellow cup. Say the colour out loud each time. Then change colour and hunt again.", {
                  minutes: 6,
                  quiz: quiz("Colours", Q("What colour is a ripe banana?", ["Yellow", "Blue", "Purple"], 0), Q("What colour do you get from the leaves of a tree?", ["Red", "Green", "Pink"], 1)),
                }),
                R("Shape detectives", "A circle is round like a plate. A square has four equal sides like a window. A triangle has three corners like a roof. Walk around and find one of each.", { minutes: 7 }),
              ),
              M(
                "Counting to ten",
                "One number at a time, with real things to touch.",
                V("Count with me", "Line up ten bottle tops. Touch each one as you say the number: one, two, three. Touching matters because every touch is one object. Try it backwards too.", {
                  minutes: 6,
                  quiz: quiz("Counting", Q("How many fingers on both hands?", ["Five", "Eight", "Ten"], 2), Q("What number comes after seven?", ["Six", "Eight", "Nine"], 1)),
                }),
                R("Number songs", "Sing 'Ten little fingers' and 'Five little ducks'. Songs help children remember the order of numbers without any pressure.", { minutes: 8 }),
              ),
            ],
          },
        ],
      },
      {
        key: "primary3",
        stream: "foundations",
        kind: "class",
        name: "Primary 3 Blue",
        level: "Primary 3, ages 8 to 9",
        framework: "uganda_primary",
        term: "Term 2",
        tutor: "Mr. Peter Okello",
        capacity: 40,
        summary: "Number work for Primary 3: times tables and sharing.",
        courses: [
          {
            key: "times",
            title: "Multiplication Made Easy",
            summary: "Understand multiplication as repeated adding and learn the 2, 5 and 10 times tables with tricks that stick.",
            outcomes: ["Explain multiplication as repeated addition", "Recite the 2, 5 and 10 times tables", "Solve simple word problems"],
            modules: [
              M(
                "What multiplication means",
                "From adding again and again to a faster way.",
                V("Groups of the same size", "3 groups of 4 apples is 4 + 4 + 4 = 12, which we write as 3 x 4 = 12. Multiplication is a shortcut for adding equal groups. Draw the groups before you write the sum.", {
                  minutes: 9,
                  quiz: quiz("Multiplication meaning", Q("What is 4 + 4 + 4 as a multiplication?", ["3 x 4", "4 x 4", "3 + 4"], 0), Q("What is 3 x 4?", ["7", "12", "10"], 1)),
                }),
                R("Arrays", "Arrange 12 bottle tops in 3 rows of 4. Turn the page: now there are 4 rows of 3. The answer is the same, so 3 x 4 = 4 x 3. This is a great way to remember tables.", { minutes: 7 }),
              ),
              M(
                "The tables 2, 5 and 10",
                "The three friendliest times tables.",
                V("Skip counting", "Count in twos: 2, 4, 6, 8, 10. In fives: 5, 10, 15, 20. In tens: 10, 20, 30. Say them while you clap or step. The last digit of the fives always goes 5, 0, 5, 0.", {
                  minutes: 8,
                  quiz: quiz("Tables 2, 5 and 10", Q("What is 5 x 6?", ["25", "30", "35"], 1), Q("What is 10 x 7?", ["17", "60", "70"], 2), Q("Double 8 is...", ["16", "18", "12"], 0)),
                }),
                P("Market problem solving", "Pretend to run a stall. If one mango costs 5 shillings (use 500 for real prices), how much do 4 mangoes cost? Write the sum, say the answer, and check it by adding.", { minutes: 12 }),
              ),
            ],
          },
        ],
      },
      {
        key: "primary5",
        stream: "foundations",
        kind: "class",
        name: "Primary 5 Gold",
        level: "Primary 5, ages 10 to 11",
        framework: "uganda_primary",
        term: "Term 2",
        tutor: "Ms. Rose Namubiru",
        capacity: 40,
        summary: "Reading well: finding meaning and details in a story.",
        courses: [
          {
            key: "reading",
            title: "Reading Comprehension: Stories from Uganda",
            summary: "Read short Ugandan stories and learn how to find the main idea, the details and the meaning of new words.",
            outcomes: ["Find the main idea of a passage", "Answer questions using details from the text", "Work out a new word from the sentence around it"],
            modules: [
              M(
                "Understanding a passage",
                "Read slowly, read twice, then answer.",
                V("Main idea and details", "The main idea is what the whole passage is about. Details are the small facts that support it. First read for the main idea, then go back and underline details that prove it.", {
                  minutes: 9,
                  quiz: quiz("Main idea", Q("The main idea of a passage is...", ["What the whole passage is about", "The first word", "The longest sentence"], 0), Q("Details in a passage...", ["Support the main idea", "Are never important", "Are always at the end"], 0)),
                }),
                R("Answering with evidence", "When a question asks 'Why?', find the sentence in the text that tells you, and say 'The text says...'. Answers that use the passage are stronger than guesses.", { minutes: 7 }),
              ),
              M(
                "Words in context",
                "Cleverly guessing new words.",
                V("Clues around the word", "If you meet a word you do not know, read the sentence before and after it. 'The kitten was so tiny that it fitted in my palm' gives you the meaning of tiny. Cover the word and ask: what word would fit here?", {
                  minutes: 8,
                  quiz: quiz("Words in context", Q("'The soup was scalding, so I waited for it to cool.' Scalding means...", ["Very hot", "Very cold", "Very tasty"], 0)),
                }),
                R("Your word book", "Keep a small notebook. Each day write one new word, the sentence you found it in, and a sentence of your own. After a month you will have thirty new words.", { minutes: 6 }),
              ),
            ],
          },
        ],
      },
    ],
  },
  {
    key: "sandra",
    name: "Sandra Akello",
    email: "sandra.akello@demo.peebee.invalid",
    phone: "+256000100005",
    school: {
      name: "Teacher Sandra: English & Phonics",
      slug: "demo-teacher-sandra",
      kind: "independent_tutor",
      streams: ["sprouts", "foundations"],
      tagline: "Home-friendly reading lessons for small children",
      bio: "Sandra is a nursery and primary teacher with twelve years of classroom experience. She now teaches reading and writing to small groups and families online, in short, cheerful lessons.",
      location: "Gulu (online lessons)",
      motto: "Every child can read",
      badge: "TSA",
    },
    classes: [
      {
        key: "phonics-club",
        stream: "sprouts",
        kind: "class",
        name: "Phonics Club",
        level: "Ages 4 to 6",
        framework: "open_syllabus",
        term: "Open enrolment",
        tutor: "Teacher Sandra",
        capacity: 20,
        summary: "Sounds first, then words: a gentle start to reading.",
        courses: [
          {
            key: "phonics",
            title: "Phonics for Beginners",
            summary: "Short daily lessons that teach the sounds letters make and how to blend them into your first words.",
            outcomes: ["Say the sounds s, a, t, p, i, n", "Blend sounds to read simple words", "Read a three-word sentence"],
            modules: [
              M(
                "First sounds",
                "Six sounds that make dozens of words.",
                V("s, a, t", "Say the sounds, not the letter names: 'sss', 'aaa', 'ttt'. Stretch the sound of the first letter and push the next one in: sss-aaa-t makes sat. Let the child feel the word in their mouth.", {
                  minutes: 7,
                  quiz: quiz("s, a, t", Q("Which word do the sounds s, a, t make?", ["sat", "tap", "pan"], 0), Q("What sound does the letter s make?", ["sss", "mmm", "ddd"], 0)),
                }),
                R("p, i, n", "Add p (pop), i (itch) and n (nnn). You can now build pin, pan, tin, tap, sip, nap. Write each on a card and let the child choose the right card when you say the word.", { minutes: 8 }),
              ),
              M(
                "Blending into words",
                "Reading, not guessing.",
                V("Sound-talking", "Point under each letter and say the sound slowly, then say it fast: 'p-a-n, pan'. Do not let the child guess from the first letter. Sounding out is the skill that lasts.", {
                  minutes: 7,
                  quiz: quiz("Blending", Q("To read 'nap' we say...", ["n-a-p, nap", "Guess from the picture", "Look at the first letter only"], 0)),
                }),
                R("Your first sentence", "Read together: 'A pin. A tin. Pat a pan.' Praise the effort, not just the answer. Short and happy beats long and tired.", { minutes: 6 }),
              ),
            ],
          },
        ],
      },
      {
        key: "story-club",
        stream: "foundations",
        kind: "class",
        name: "Story Writing Club",
        level: "Ages 7 to 11",
        framework: "open_syllabus",
        term: "Open enrolment",
        tutor: "Teacher Sandra",
        capacity: 20,
        summary: "From an idea to a finished story with a beginning, middle and end.",
        courses: [
          {
            key: "storywriting",
            title: "Write Your Own Story",
            summary: "Plan and write a short story with a character, a problem and a happy ending.",
            outcomes: ["Plan a story with a beginning, middle and end", "Describe a character using details", "Edit your own writing"],
            modules: [
              M(
                "Planning",
                "Good stories start before the first sentence.",
                V("Character, place, problem", "Every story needs somebody (character), somewhere (setting) and something going wrong (problem). Write one sentence for each before you begin. A girl called Amina, a market, a lost goat: that is already a story.", {
                  minutes: 8,
                  quiz: quiz("Story planning", Q("A story problem is...", ["Something that goes wrong for the character", "A spelling mistake", "The title"], 0), Q("The setting is...", ["Where and when the story happens", "The main character", "The ending"], 0)),
                }),
                R("Beginning, middle, end", "Fold a page in three. In the first part write how things begin, in the second the problem gets bigger, in the third how it is solved. You now have a map for your story.", { minutes: 7 }),
              ),
              M(
                "Writing and editing",
                "Make it good, then make it better.",
                V("Show, don't tell", "Instead of 'Amina was scared', write 'Amina's hands shook and her voice went small'. Details let your reader feel the story. Try changing one 'told' sentence into a 'shown' one.", { minutes: 8 }),
                R("The editing checklist", "Read your story aloud. Check: does every sentence start with a capital letter and end with a full stop? Did I use 'said' too often? Is there a sentence I can make stronger? Then read it to someone.", { minutes: 7 }),
              ),
            ],
          },
        ],
      },
    ],
  },
  {
    key: "brian",
    name: "Brian Kiiza",
    email: "brian.kiiza@demo.peebee.invalid",
    phone: "+256000100006",
    school: {
      name: "Coach Brian: Maths Clinic",
      slug: "demo-coach-brian-maths-clinic",
      kind: "independent_tutor",
      streams: ["foundations", "academy"],
      tagline: "Maths that finally makes sense",
      bio: "Brian has coached primary and secondary pupils in mathematics for ten years. His clinic gives short, clear lessons and plenty of practice, and he is known for turning 'I hate maths' into 'I get it'.",
      location: "Mbarara (online lessons)",
      motto: "Understand first, practise second",
      badge: "CBM",
    },
    classes: [
      {
        key: "clinic-primary",
        stream: "foundations",
        kind: "class",
        name: "Primary Maths Clinic",
        level: "Primary 4 to 6",
        framework: "uganda_primary",
        term: "Open enrolment",
        tutor: "Coach Brian",
        capacity: 30,
        summary: "Fractions, decimals and word problems for upper primary.",
        courses: [
          {
            key: "fractions",
            title: "Fractions Without Tears",
            summary: "See fractions as parts of a whole, compare them and add them with the same bottom number.",
            outcomes: ["Name the numerator and denominator", "Compare simple fractions", "Add fractions with the same denominator"],
            modules: [
              M(
                "Understanding fractions",
                "What the numbers on a fraction really say.",
                V("Parts of a whole", "Cut a chapati into 4 equal pieces and eat 1: you ate one quarter, written 1/4. The bottom number (denominator) says how many equal parts; the top number (numerator) says how many we take.", {
                  minutes: 9,
                  quiz: quiz("Fractions", Q("In 3/5, what is the denominator?", ["3", "5", "8"], 1, "The denominator is the bottom number: how many equal parts in the whole."), Q("A pizza is cut in 8 equal slices and you eat 2. What fraction did you eat?", ["2/8", "8/2", "6/8"], 0)),
                }),
                R("Which is bigger?", "When the top numbers are the same, the bigger bottom number means smaller pieces: 1/2 is bigger than 1/4. Draw two bars of the same length and shade them to see it.", { minutes: 7 }),
              ),
              M(
                "Adding fractions",
                "Same denominator first.",
                V("Add the tops, keep the bottom", "1/5 + 2/5 = 3/5. The pieces are the same size, so we simply count how many pieces we have. Never add the bottom numbers.", {
                  minutes: 8,
                  quiz: quiz("Adding fractions", Q("1/6 + 3/6 = ?", ["4/6", "4/12", "3/6"], 0), Q("2/7 + 4/7 = ?", ["6/14", "6/7", "8/7"], 1)),
                }),
                P("Fraction kitchen", "Use a measuring cup or a bottle. Fill 1/4 and then another 1/4: how much water do you have? Pour it into a bigger bottle and check your answer by measuring.", { minutes: 12 }),
              ),
            ],
          },
        ],
      },
      {
        key: "clinic-secondary",
        stream: "academy",
        kind: "class",
        name: "Secondary Maths Clinic",
        level: "S1 to S4",
        framework: "uneb_olevel",
        term: "Open enrolment",
        tutor: "Coach Brian",
        capacity: 30,
        summary: "Algebra and equations explained in plain language.",
        courses: [
          {
            key: "algebra",
            title: "Algebra Essentials",
            summary: "Letters stand for numbers. Learn to simplify, solve linear equations and check your answers.",
            outcomes: ["Simplify expressions by collecting like terms", "Solve a linear equation step by step", "Check an answer by substitution"],
            modules: [
              M(
                "Expressions",
                "Writing and tidying up algebra.",
                V("Like terms", "In 3x + 2x we have 5x because both terms are in x. You can only add or subtract like terms: 3x + 2 cannot be simplified. Think of x as a kind of fruit: 3 mangoes plus 2 mangoes is 5 mangoes.", {
                  minutes: 9,
                  quiz: quiz("Like terms", Q("Simplify 4a + 3a.", ["7a", "7a²", "12a"], 0), Q("Simplify 5x + 2 + 3x.", ["10x", "8x + 2", "8x"], 1)),
                }),
                R("Brackets", "Multiply every term inside the bracket: 3(x + 4) = 3x + 12. A common mistake is to multiply only the first term. Draw arrows from the number to each term as you work.", { minutes: 7 }),
              ),
              M(
                "Solving equations",
                "Keep the equation balanced.",
                V("The balance method", "Whatever you do to one side you must do to the other. To solve x + 5 = 12, subtract 5 from both sides: x = 7. For 3x = 21, divide both sides by 3: x = 7.", {
                  minutes: 10,
                  quiz: quiz("Equations", Q("Solve x + 9 = 15.", ["x = 6", "x = 24", "x = 9"], 0), Q("Solve 4x = 28.", ["x = 7", "x = 24", "x = 32"], 0), Q("Solve 2x + 1 = 9.", ["x = 4", "x = 5", "x = 8"], 0)),
                }),
                R("Always check", "Put your answer back into the original equation. If 2x + 1 = 9 and x = 4, then 2(4) + 1 = 9, which is true. Checking takes twenty seconds and saves marks in exams.", { minutes: 6 }),
              ),
            ],
          },
        ],
      },
    ],
  },
];
