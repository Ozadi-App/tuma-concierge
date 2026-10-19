import { M, P, Q, quiz, R, V, type DemoEducator } from "./types.js";

/** Academy (secondary) and Compass (university and college). */
export const SENIOR_EDUCATORS: DemoEducator[] = [
  {
    key: "lakeview",
    name: "Daniel Ssekandi",
    email: "daniel.ssekandi@demo.peebee.invalid",
    phone: "+256000100002",
    school: {
      name: "Lakeview Senior Secondary School",
      slug: "demo-lakeview-senior-secondary",
      kind: "school",
      streams: ["academy"],
      tagline: "O-Level and A-Level by Lake Victoria",
      bio: "A mixed day and boarding school in Entebbe with strong results in sciences and arts. Every class has a dedicated tutor and weekly revision support for UNEB candidates.",
      location: "Entebbe",
      motto: "Discipline. Knowledge. Service.",
      badge: "LSS",
    },
    classes: [
      {
        key: "s2sci",
        stream: "academy",
        kind: "class",
        name: "S2 Sciences",
        level: "Senior 2",
        framework: "uneb_olevel",
        term: "Term 2",
        tutor: "Mr. David Mugisha",
        capacity: 45,
        summary: "Cells, living things and how the body works.",
        courses: [
          {
            key: "biology",
            title: "Biology: Cells and Living Things",
            summary: "Explore what cells are made of, how they differ in plants and animals, and how substances move in and out.",
            outcomes: ["Label the parts of plant and animal cells", "Describe diffusion and osmosis", "Use a microscope safely"],
            modules: [
              M(
                "The cell",
                "The building block of life.",
                V("Plant and animal cells", "All living things are made of cells. Both plant and animal cells have a nucleus, cytoplasm, a cell membrane and mitochondria. Plant cells also have a cell wall, chloroplasts and a large vacuole.", {
                  minutes: 10,
                  quiz: quiz("Cells", Q("Which part controls the activities of the cell?", ["Nucleus", "Cell wall", "Vacuole"], 0), Q("Which is found only in plant cells?", ["Chloroplasts", "Cell membrane", "Cytoplasm"], 0, "Chloroplasts contain chlorophyll, which plants use for photosynthesis.")),
                }),
                P("Using a microscope", "Place a thin slice of onion skin on a slide. Start with the lowest-power lens, focus with the coarse knob, then the fine knob. Draw what you see and label the cell wall and nucleus.", { minutes: 15 }),
              ),
              M(
                "Moving substances",
                "How cells take in what they need.",
                V("Diffusion and osmosis", "Diffusion is the movement of particles from a place of high concentration to low concentration. Osmosis is the diffusion of water through a partially permeable membrane. A raisin in water swells because water moves into it by osmosis.", {
                  minutes: 10,
                  quiz: quiz("Diffusion and osmosis", Q("Osmosis is the movement of...", ["Water across a partially permeable membrane", "Sugar only", "Air through a leaf"], 0), Q("Diffusion moves particles from...", ["High to low concentration", "Low to high concentration", "Neither"], 0)),
                }),
                R("Revision notes", "Make a one-page summary: draw both cells side by side, list three differences, then write one example each of diffusion and osmosis from daily life (perfume across a room; a wilted lettuce in water).", { minutes: 8 }),
              ),
            ],
          },
        ],
      },
      {
        key: "s4rev",
        stream: "academy",
        kind: "class",
        name: "S4 UNEB Revision",
        level: "Senior 4 candidates",
        framework: "uneb_olevel",
        term: "Term 3",
        tutor: "Ms. Esther Achieng",
        capacity: 60,
        summary: "Exam technique and revision for O-Level Mathematics.",
        courses: [
          {
            key: "mathrev",
            title: "O-Level Maths Revision: Geometry and Statistics",
            summary: "Angles, triangles and averages: the topics that appear in every paper, with exam tips.",
            outcomes: ["Find unknown angles using angle rules", "Use Pythagoras' theorem", "Calculate mean, median and mode"],
            modules: [
              M(
                "Geometry",
                "Angles and triangles.",
                V("Angle rules", "Angles on a straight line add up to 180 degrees. Angles in a triangle add up to 180 degrees. Angles around a point add up to 360 degrees. Always write the rule next to your working.", {
                  minutes: 10,
                  quiz: quiz("Angle rules", Q("Two angles on a straight line: one is 115 degrees. The other is...", ["65 degrees", "75 degrees", "245 degrees"], 0), Q("The angles of a triangle add up to...", ["180 degrees", "90 degrees", "360 degrees"], 0)),
                }),
                R("Pythagoras", "In a right-angled triangle, a squared plus b squared equals c squared, where c is the longest side (the hypotenuse). For sides 3 and 4: 9 + 16 = 25, so the hypotenuse is 5.", { minutes: 8, quiz: quiz("Pythagoras", Q("A right-angled triangle has sides 6 and 8. The hypotenuse is...", ["10", "14", "12"], 0)) }),
              ),
              M(
                "Statistics",
                "Averages and what they tell us.",
                V("Mean, median, mode", "For 2, 3, 3, 5, 7: the mean is the total divided by the count (20 / 5 = 4); the median is the middle value when ordered (3); the mode is the most frequent value (3). Show each step to earn method marks.", {
                  minutes: 9,
                  quiz: quiz("Averages", Q("The mean of 4, 6 and 8 is...", ["6", "18", "8"], 0), Q("The mode of 1, 2, 2, 3, 4 is...", ["2", "3", "1"], 0)),
                }),
                R("Exam technique", "Read the question twice. Underline the command word (calculate, explain, show). Write units. Leave time to check. If you are stuck, move on and return: marks are the same on every question.", { minutes: 5 }),
              ),
            ],
          },
        ],
      },
      {
        key: "s6arts",
        stream: "academy",
        kind: "class",
        name: "S6 Arts and Humanities",
        level: "Senior 6 (A-Level)",
        framework: "uneb_alevel",
        term: "Term 1",
        tutor: "Mr. Joseph Ssemanda",
        capacity: 40,
        summary: "Economics for A-Level: markets, prices and choices.",
        courses: [
          {
            key: "econ",
            title: "A-Level Economics: Demand and Supply",
            summary: "How prices are set in a market, what makes demand and supply move, and what happens when governments step in.",
            outcomes: ["Explain the law of demand and supply", "Show a shift of a curve with a diagram", "Describe the effect of a price ceiling"],
            modules: [
              M(
                "Demand",
                "What buyers want and can pay for.",
                V("The law of demand", "As the price of a good rises, the quantity demanded falls, other things staying equal. Demand shifts to the right if incomes rise or if the good becomes fashionable. A change in the good's own price moves along the curve; it does not shift it.", {
                  minutes: 11,
                  quiz: quiz("Demand", Q("A rise in the price of matooke will cause...", ["A fall in quantity demanded", "A shift of the demand curve right", "No change"], 0), Q("Which causes a shift of the demand curve?", ["A change in consumers' income", "A change in the good's own price"], 0)),
                }),
                R("Elasticity", "Price elasticity of demand measures how strongly buyers react to a price change. Necessities such as salt are inelastic: people keep buying. Luxuries are elastic: people buy much less when the price rises.", { minutes: 8 }),
              ),
              M(
                "Supply and equilibrium",
                "Where buyers and sellers meet.",
                V("Equilibrium price", "The equilibrium price is where quantity demanded equals quantity supplied. If the price is above it there is a surplus and the price falls; if below it there is a shortage and the price rises.", {
                  minutes: 11,
                  quiz: quiz("Equilibrium", Q("At a price above equilibrium there is...", ["A surplus", "A shortage", "Perfect balance"], 0, "More is supplied than demanded, so sellers cut prices.")),
                }),
                R("Government intervention", "A price ceiling (maximum price) below equilibrium causes shortages and black markets. A price floor above equilibrium causes surpluses. Use a diagram in every answer and explain what moves.", { minutes: 8 }),
              ),
            ],
          },
        ],
      },
    ],
  },
  {
    key: "nilebiz",
    name: "Patrick Mwesigwa",
    email: "patrick.mwesigwa@demo.peebee.invalid",
    phone: "+256000100003",
    school: {
      name: "Nile Business College",
      slug: "demo-nile-business-college",
      kind: "college",
      streams: ["compass"],
      tagline: "Business diplomas and short courses in Jinja",
      bio: "A practical business college on the banks of the Nile. Diploma programmes, evening classes and masterclasses taught by working accountants, marketers and analysts.",
      location: "Jinja",
      motto: "Learn it. Use it on Monday.",
      badge: "NBC",
    },
    classes: [
      {
        key: "diploma1",
        stream: "compass",
        kind: "class",
        name: "Diploma in Business Administration, Year 1",
        level: "Diploma, Year 1",
        framework: "university_credit",
        term: "Semester 1",
        tutor: "Dr. Samuel Kato",
        capacity: 60,
        summary: "The first-year core: accounting and business communication.",
        courses: [
          {
            key: "accounting",
            title: "Principles of Accounting",
            summary: "The accounting equation, double entry and a simple trial balance, using small Ugandan businesses as examples.",
            outcomes: ["State the accounting equation", "Record transactions using double entry", "Prepare a trial balance"],
            modules: [
              M(
                "The foundations",
                "What accounting records and why.",
                V("The accounting equation", "Assets = Liabilities + Equity. If you start a shop with 5,000,000 of your own money, assets are 5,000,000 and equity is 5,000,000. If you buy stock on credit for 1,000,000, assets and liabilities both rise by 1,000,000 and the equation still balances.", {
                  minutes: 12,
                  quiz: quiz("Accounting equation", Q("Assets = ...", ["Liabilities + Equity", "Liabilities - Equity", "Equity - Income"], 0), Q("Buying stock on credit increases...", ["Assets and liabilities", "Equity only", "Nothing"], 0)),
                }),
                R("Debits and credits", "Every transaction has two sides. Debit the account that receives value, credit the account that gives it. Paying rent in cash: debit Rent expense, credit Cash. Practise with ten transactions.", { minutes: 9 }),
              ),
              M(
                "From records to reports",
                "Making the books useful.",
                V("The trial balance", "After posting all entries, list every ledger balance. Total debits must equal total credits. If they do not, look for a transposed figure, a one-sided entry or an arithmetic slip.", {
                  minutes: 10,
                  quiz: quiz("Trial balance", Q("In a trial balance, total debits should...", ["Equal total credits", "Be higher than credits", "Be zero"], 0)),
                }),
                P("Run a shop for a week", "Use a notebook to record ten sales and purchases for a pretend shop. At the end of the week prepare a trial balance and list what you learned from any difference.", { minutes: 25 }),
              ),
            ],
          },
        ],
      },
      {
        key: "digital-masterclass",
        stream: "compass",
        kind: "masterclass",
        name: "Digital Marketing Masterclass",
        level: "Short programme, 4 weeks",
        framework: "professional_certificate",
        term: "Rolling intake",
        tutor: "Ms. Prisca Nanyonga",
        capacity: 80,
        summary: "Get customers online with a small budget.",
        courses: [
          {
            key: "digimarket",
            title: "Digital Marketing for Small Businesses",
            summary: "Pick the right online channels, write posts that sell and measure what works, with examples from Ugandan shops and services.",
            outcomes: ["Choose two channels for your customers", "Plan a month of posts", "Track results with three simple numbers"],
            modules: [
              M(
                "Find your customers",
                "Start with people, not platforms.",
                V("Who buys from you?", "Describe your best customer in one paragraph: age, location, what they care about, where they spend time online. A hair salon in Jinja and a spare-parts dealer in Kampala need different channels.", {
                  minutes: 9,
                  quiz: quiz("Customers", Q("The first step in digital marketing is to...", ["Know your customer", "Buy followers", "Open every social account"], 0)),
                }),
                R("Choosing channels", "WhatsApp Business is excellent for repeat customers, Facebook for local reach, Instagram for visual products, Google Business Profile for being found on a map. Choose two and do them well.", { minutes: 8 }),
              ),
              M(
                "Content and results",
                "Posts that people act on.",
                V("Write a post that sells", "Use the pattern: problem, solution, proof, action. 'Tired of slow wi-fi? Our router fits any room. 40 happy customers in Jinja. Message us on WhatsApp today.' One clear action per post.", {
                  minutes: 10,
                  quiz: quiz("Posts", Q("A good post ends with...", ["One clear action", "Five different links", "An apology"], 0)),
                }),
                P("Your first month", "Plan 12 posts: 4 helpful tips, 4 product posts, 4 customer stories. Post for two weeks, then count messages received, sales made and cost per sale.", { minutes: 20 }),
              ),
            ],
          },
        ],
      },
      {
        key: "data-cert",
        stream: "compass",
        kind: "class",
        name: "Data Skills Certificate",
        level: "Certificate, part-time",
        framework: "professional_certificate",
        term: "Evening class",
        tutor: "Prof. Anne Tumusiime",
        capacity: 35,
        summary: "Spreadsheets that answer business questions.",
        courses: [
          {
            key: "spreadsheets",
            title: "Spreadsheets for Business Analysis",
            summary: "Clean a table, use formulas and build a pivot table to answer a real question about sales.",
            outcomes: ["Write SUM, AVERAGE and IF formulas", "Sort and filter data safely", "Build a simple pivot table"],
            modules: [
              M(
                "Formulas",
                "Let the spreadsheet do the sums.",
                V("Your first formulas", "A formula starts with =. =SUM(B2:B20) adds a column, =AVERAGE(B2:B20) finds the mean, and =IF(B2>100000,\"High\",\"Low\") labels each sale. Fill a formula down a column by dragging the corner.", {
                  minutes: 12,
                  quiz: quiz("Formulas", Q("A formula in a spreadsheet starts with...", ["=", "#", "$"], 0), Q("Which formula adds the cells B2 to B20?", ["=SUM(B2:B20)", "=ADD(B2,B20)", "=TOTAL B2-B20"], 0)),
                }),
                R("Keep the data clean", "One row per record, one column per fact, no blank rows, no merged cells. A clean table is the secret to quick analysis. Fix problems before you start calculating.", { minutes: 7 }),
              ),
              M(
                "Answering questions",
                "From rows of numbers to a decision.",
                V("Pivot tables", "A pivot table summarises thousands of rows in seconds: choose Product as rows and Sum of Sales as values and you see which product earns most. Try adding Month as columns.", {
                  minutes: 12,
                  quiz: quiz("Pivot tables", Q("A pivot table is used to...", ["Summarise data by categories", "Print a page", "Spell-check text"], 0)),
                }),
                P("Sales review", "Download or type 50 rows of sales. Build a pivot table by product and by month. Write three sentences for the owner: what sold best, what is falling, and one action to take.", { minutes: 30 }),
              ),
            ],
          },
        ],
      },
    ],
  },
  {
    key: "lydia",
    name: "Lydia Namatovu",
    email: "lydia.namatovu@demo.peebee.invalid",
    phone: "+256000100008",
    school: {
      name: "Dr. Lydia: Study and Career Coaching",
      slug: "demo-dr-lydia-coaching",
      kind: "independent_tutor",
      streams: ["compass", "skills"],
      tagline: "Study smarter. Get the interview.",
      bio: "Dr. Lydia lectures at a university and coaches students and graduates one to one. Her short courses cover how to study, how to write a CV and how to handle an interview.",
      location: "Kampala (online lessons)",
      motto: "Clarity creates confidence",
      badge: "DLC",
    },
    classes: [
      {
        key: "study",
        stream: "compass",
        kind: "class",
        name: "University Study Skills",
        level: "First-year university",
        framework: "university_credit",
        term: "Open enrolment",
        tutor: "Dr. Lydia",
        capacity: 50,
        summary: "How to learn, read and write at university level.",
        courses: [
          {
            key: "studyskills",
            title: "Study Skills for University",
            summary: "Plan your week, take notes you can use, read academic texts quickly and avoid plagiarism.",
            outcomes: ["Build a weekly study timetable", "Take notes with the Cornell method", "Reference sources correctly"],
            modules: [
              M(
                "Learning how to learn",
                "Habits that make studying easier.",
                V("Plan your week", "Block fixed times for lectures, study, rest and sleep. Study in sessions of 25 to 45 minutes with short breaks. The best time to review a lecture is within 24 hours of hearing it.", {
                  minutes: 10,
                  quiz: quiz("Planning", Q("When should you review a lecture for best memory?", ["Within 24 hours", "Just before the exam", "Never"], 0), Q("Which session length works well?", ["25 to 45 minutes", "Six hours without a break", "Five minutes"], 0)),
                }),
                R("Cornell notes", "Divide the page: a narrow left column for key questions, a wide right column for notes, a bottom box for a summary. Afterwards, cover the notes and answer the questions on the left to test yourself.", { minutes: 7 }),
              ),
              M(
                "Reading and writing",
                "Academic work without the stress.",
                V("Read faster, remember more", "Skim first: title, headings, introduction, conclusion. Then read the sections you need. Write one sentence after each section in your own words. If you cannot, you have not understood it yet.", { minutes: 9 }),
                R("Avoiding plagiarism", "Plagiarism is using someone else's words or ideas without credit. Paraphrase in your own words and still cite the source. Keep a list of every source as you read and use one referencing style.", {
                  minutes: 6,
                  quiz: quiz("Plagiarism", Q("If you paraphrase an author's idea, you should...", ["Still cite them", "Not mention them", "Change two words only"], 0)),
                }),
              ),
            ],
          },
        ],
      },
      {
        key: "career",
        stream: "skills",
        kind: "class",
        name: "Career Ready",
        level: "Graduates and job seekers",
        framework: "open_syllabus",
        term: "Open enrolment",
        tutor: "Dr. Lydia",
        capacity: 50,
        summary: "A clear CV and a calm interview.",
        courses: [
          {
            key: "careerready",
            title: "CVs and Interviews that Get Replies",
            summary: "Write a one-page CV, a short cover letter and answer the questions every interviewer asks.",
            outcomes: ["Write a clear one-page CV", "Prepare answers using the STAR method", "Follow up after an interview"],
            modules: [
              M(
                "Your CV",
                "One page that shows your value.",
                V("A one-page CV", "Put your name and contacts at the top, then a two-line profile, your experience with results (\"Sold 40 phones a month\"), education and skills. Use a plain font, no photo needed, and send it as a PDF.", {
                  minutes: 9,
                  quiz: quiz("CV", Q("A good CV is usually...", ["One clear page", "Six pages", "Only a photo"], 0), Q("Which line is stronger?", ["Sold 40 phones a month", "Responsible for sales"], 0)),
                }),
                R("The cover letter", "Three short paragraphs: why this job, why you (with one proof), and how to reach you. Address a named person if you can and mention the company by name.", { minutes: 6 }),
              ),
              M(
                "The interview",
                "Prepare, answer, follow up.",
                V("The STAR method", "Answer 'Tell me about a time...' with Situation, Task, Action, Result. Prepare three real stories in advance. Speak for about two minutes and finish with what you learned.", {
                  minutes: 10,
                  quiz: quiz("STAR", Q("STAR stands for...", ["Situation, Task, Action, Result", "Skill, Time, Action, Reward", "Start, Talk, Answer, Repeat"], 0)),
                }),
                R("After the interview", "Send a short thank-you message within a day. Note what went well and what to improve. If you hear nothing in a week, a polite follow-up shows you are serious.", { minutes: 5 }),
              ),
            ],
          },
        ],
      },
    ],
  },
];
