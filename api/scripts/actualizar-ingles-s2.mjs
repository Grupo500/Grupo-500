// Actualiza las preguntas de Inglés (80-124) de la Sesión 2, Simulacro 2.
// Cada parte tiene un formato distinto; este script pone las opciones y respuestas correctas.
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

// Banco de palabras compartido para preguntas 80-84
const BANCO = {
  opcionA: "Burger", opcionB: "Chips", opcionC: "Coffee", opcionD: "Lemonade",
  opcionE: "Noodles", opcionF: "Pancake", opcionG: "Pie", opcionH: "Sausage",
};
const CONTEXTO_BANCO =
  "Lea cada descripción y encuentra la palabra del banco que corresponde.\n\n" +
  "Banco de palabras:\nA. Burger   B. Chips   C. Coffee   D. Lemonade\nE. Noodles   F. Pancake   G. Pie   H. Sausage\n\n" +
  "Ejemplo: 0. It is long, and there is meat in it.  →  H. Sausage\n" +
  "(Sobran dos palabras del banco.)";

// Contexto Repair Cafés para preguntas 95-102
const CONTEXTO_REPAIR =
  "Lea el texto y seleccione la palabra correcta para cada espacio.\n\n" +
  "Repair Cafés\n\n" +
  "Repair Cafés are free meeting places (0=where) you'll find equipment and specialists who will help you make things as good as new. " +
  "Visitors from (95)________ the world bring broken objects such as furniture or laptops, and work among people with amazing technical abilities in (96)________ fields. " +
  "If you don't have (97)________ that needs repairing, you can still stay and enjoy a delicious snack. " +
  "At the same time you can help someone (98)________.\n\n" +
  "Martina Becker (99)________ the first Repair Café in Amsterdam in 2009. (100)________ she was working there, she dreamed of opening the Repair Café Foundation. " +
  "She finally did so some years later. This organization has offered help in building new cafés in the Netherlands (101)________ 2011. " +
  "Today, Martina feels the (102)________ person on the planet because there are now over a thousand Repair Cafés serving customers.";

// Contexto Writers para preguntas 103-109
const CONTEXTO_WRITERS =
  "Lea el texto y responda las preguntas.\n\n" +
  "Writers\n\n" +
  "I'm Mike Darvy, a journalist, and in my articles I discuss how difficult it is to write. Last week, a foreign colleague suggested that I write a document describing the daily activities different writers follow. It immediately made me think about my own routine and Ana Fitzgerald's, a singer famous for writing songs, whose routine was quite different from mine.\n\n" +
  "Anna's days began at 4 a.m., weekdays and weekends. Her alarm clock had a loud ring so she could hear it. She spent half the day playing jazz and taking short notes. At 1 p.m., after lunchtime, she wrote lots of lines for her songs until 6 p.m. Then, she exercised for about two hours while singing her new songs. Her days always ended with a healthy dinner, and went to bed at 10 pm.\n\n" +
  "My days are quite different. I don't have a daily plan and I don't use alarms. I usually wake up and see if I have any events for the day. If I'm free, I read the latest news on my cell phone. During the day I just let things happen. Every friday I visit my cousins; their opinions are quite useful. In the evenings, I go for a walk, which helps me find information that I use in my writings. Then, I write for several hours after midnight. On Sundays, I spend time with my girlfriend at home.";

// Contexto Lost City para preguntas 110-114
const CONTEXTO_LOST_CITY =
  "Lea el texto y responda las preguntas.\n\n" +
  "It was the first time I traveled to South America, and I was surprised by the incredible landscapes in the Lost City in Colombia. My luggage was light because I would have to walk a lot. As soon as I reached Colombia, I was attracted by the mystery of the 'Lost City' ruins, which are thought to be older than Peru's Machu Picchu.\n\n" +
  "After five days of adventure on the coast, which included recovering from an illness, I waved goodbye to some friends in Santa Marta as I set off on a four-day walk to the Lost City. I joined a group of strong explorers and their guide, Hernan. I was the only one who walked very slowly. However, that did not stop me moving with the group up the magic mountain range. Almost three days of walking for nine hours a day is part of this adventure; trust me, it's totally worth the sore legs!\n\n" +
  "We stopped to dive into cool pools and were impressed by blue butterflies, some of the biggest in the world, which accompanied us during the journey. At every camp, we ate fresh pineapple and oranges. The camps along the way appeared like illusions in the hot desert after a long day's walk. But the best of all was the three-course meal on the menu every night, thanks to the efforts of chefs who climbed on ahead to get it ready.\n\n" +
  "The people who were born there see themselves as guardians of the planet, and that's great! We cannot offer them anything of importance since they have everything they need. Both adults and children show their happiness by being polite with tourists; the children exchange a photo for chocolates.";

// Contexto Dogs para preguntas 115-124
const CONTEXTO_DOGS =
  "Lea el texto y seleccione la palabra correcta para cada espacio.\n\n" +
  "Dogs are like people\n\n" +
  "Two years ago, my colleagues and I began (0=researching) into the brains of dogs. Some dogs had to go into an M.R.I scanner (115)________ awake. We wanted to (116)________ how dog brains work. An M.R.I scanner can (117)________ information about their thoughts.\n\n" +
  "The dog owners agreed to this by (118)________ a contract. In the study, we used positive training (119)________; the dogs could leave the scanner (120)________ they wanted.\n\n" +
  "My dog Lassie, which was (121)________ by a homeless dog charity, was the first. After training Lassie for months, we got the first maps of her brain activity. This was a great (122)________ for our effort.\n\n" +
  "In later experiments, we (123)________ the similarity between dogs and humans in an important brain region: the caudate nucleus. In humans, this part plays an important role in the anticipation of things we enjoy, like food. (124)________ these facts about the canine brain are limited, they cannot be ignored.";

const ACTUALIZACIONES = [
  // ── PARTE 1: Matching A-H (80-84) ──────────────────────────────────────
  { numero: 80, enunciado: "Some people make soup with these.", contexto: CONTEXTO_BANCO, ...BANCO, correcta: "E", area: "Inglés" },
  { numero: 81, enunciado: "It has bread, meat, tomato and onion.", contexto: CONTEXTO_BANCO, ...BANCO, correcta: "A", area: "Inglés" },
  { numero: 82, enunciado: "You drink a glass of this when you're thirsty.", contexto: CONTEXTO_BANCO, ...BANCO, correcta: "D", area: "Inglés" },
  { numero: 83, enunciado: "People make this thin, round food with milk and eggs for breakfast.", contexto: CONTEXTO_BANCO, ...BANCO, correcta: "F", area: "Inglés" },
  { numero: 84, enunciado: "Some people enjoy this hot black drink with sugar.", contexto: CONTEXTO_BANCO, ...BANCO, correcta: "C", area: "Inglés" },

  // ── PARTE 2: Conversación A/B/C (85-89) ────────────────────────────────
  { numero: 85, enunciado: "I can clean the house for you today.", contexto: "Complete las conversaciones.", opcionA: "That's nice!", opcionB: "They're mine.", opcionC: "How many?", opcionD: null, opcionE: null, opcionF: null, opcionG: null, opcionH: null, correcta: "A", area: "Inglés" },
  { numero: 86, enunciado: "Shall we cook something? I'm hungry.", contexto: "Complete las conversaciones.", opcionA: "How often?", opcionB: "I brought one!", opcionC: "What about chicken?", opcionD: null, opcionE: null, opcionF: null, opcionG: null, opcionH: null, correcta: "C", area: "Inglés" },
  { numero: 87, enunciado: "How long will the journey take?", contexto: "Complete las conversaciones.", opcionA: "Over two hours.", opcionB: "At midnight.", opcionC: "I won't be late.", opcionD: null, opcionE: null, opcionF: null, opcionG: null, opcionH: null, correcta: "A", area: "Inglés" },
  { numero: 88, enunciado: "May I borrow your bracelet, please?", contexto: "Complete las conversaciones.", opcionA: "A little bit.", opcionB: "In cash.", opcionC: "Sure.", opcionD: null, opcionE: null, opcionF: null, opcionG: null, opcionH: null, correcta: "C", area: "Inglés" },
  { numero: 89, enunciado: "Oh, dear! I forgot how to use this cell phone.", contexto: "Complete las conversaciones.", opcionA: "It's repaired.", opcionB: "Let me help you.", opcionC: "Be prepared.", opcionD: null, opcionE: null, opcionF: null, opcionG: null, opcionH: null, correcta: "B", area: "Inglés" },

  // ── PARTE 3: Avisos/señales A/B/C (90-94) — necesitan imagen ───────────
  { numero: 90, enunciado: "¿Dónde puedes ver este aviso? (ver imagen)", contexto: "¿Dónde puede ver estos avisos?", opcionA: "In a classroom.", opcionB: "At a shop.", opcionC: "On a farm.", opcionD: null, opcionE: null, opcionF: null, opcionG: null, opcionH: null, correcta: "B", area: "Inglés" },
  { numero: 91, enunciado: "¿Dónde puedes ver este aviso? (ver imagen)", contexto: "¿Dónde puede ver estos avisos?", opcionA: "On a kitchen wall.", opcionB: "On a food box.", opcionC: "On a handbag.", opcionD: null, opcionE: null, opcionF: null, opcionG: null, opcionH: null, correcta: "B", area: "Inglés" },
  { numero: 92, enunciado: "¿Dónde puedes ver este aviso? (ver imagen)", contexto: "¿Dónde puede ver estos avisos?", opcionA: "In a bookshop.", opcionB: "In a playground.", opcionC: "In a classroom.", opcionD: null, opcionE: null, opcionF: null, opcionG: null, opcionH: null, correcta: "A", area: "Inglés" },
  { numero: 93, enunciado: "¿Dónde puedes ver este aviso? (ver imagen)", contexto: "¿Dónde puede ver estos avisos?", opcionA: "In a computer room.", opcionB: "In a sports room.", opcionC: "In a music room.", opcionD: null, opcionE: null, opcionF: null, opcionG: null, opcionH: null, correcta: "C", area: "Inglés" },
  { numero: 94, enunciado: "¿Dónde puedes ver este aviso? (ver imagen) — PICK UP YOUR KIDS HERE", contexto: "¿Dónde puede ver estos avisos?", opcionA: "In the garden.", opcionB: "On the beach.", opcionC: "At the school.", opcionD: null, opcionE: null, opcionF: null, opcionG: null, opcionH: null, correcta: "C", area: "Inglés" },

  // ── PARTE 4: Repair Cafés gap-fill A/B/C (95-102) ──────────────────────
  { numero: 95, enunciado: "Visitors from ________ the world bring broken objects.", contexto: CONTEXTO_REPAIR, opcionA: "above", opcionB: "outside", opcionC: "around", opcionD: null, opcionE: null, opcionF: null, opcionG: null, opcionH: null, correcta: "C", area: "Inglés" },
  { numero: 96, enunciado: "...work among people with amazing technical abilities in ________ fields.", contexto: CONTEXTO_REPAIR, opcionA: "several", opcionB: "each", opcionC: "much", opcionD: null, opcionE: null, opcionF: null, opcionG: null, opcionH: null, correcta: "A", area: "Inglés" },
  { numero: 97, enunciado: "If you don't have ________ that needs repairing, you can still stay.", contexto: CONTEXTO_REPAIR, opcionA: "anything", opcionB: "anywhere", opcionC: "anyone", opcionD: null, opcionE: null, opcionF: null, opcionG: null, opcionH: null, correcta: "A", area: "Inglés" },
  { numero: 98, enunciado: "At the same time you can help someone ________.", contexto: CONTEXTO_REPAIR, opcionA: "once", opcionB: "else", opcionC: "enough", opcionD: null, opcionE: null, opcionF: null, opcionG: null, opcionH: null, correcta: "B", area: "Inglés" },
  { numero: 99, enunciado: "Martina Becker ________ the first Repair Café in Amsterdam in 2009.", contexto: CONTEXTO_REPAIR, opcionA: "began", opcionB: "begin", opcionC: "begun", opcionD: null, opcionE: null, opcionF: null, opcionG: null, opcionH: null, correcta: "A", area: "Inglés" },
  { numero: 100, enunciado: "________ she was working there, she dreamed of opening the Repair Café Foundation.", contexto: CONTEXTO_REPAIR, opcionA: "So", opcionB: "While", opcionC: "Except", opcionD: null, opcionE: null, opcionF: null, opcionG: null, opcionH: null, correcta: "B", area: "Inglés" },
  { numero: 101, enunciado: "This organization has offered help in building new cafés in the Netherlands ________ 2011.", contexto: CONTEXTO_REPAIR, opcionA: "since", opcionB: "for", opcionC: "until", opcionD: null, opcionE: null, opcionF: null, opcionG: null, opcionH: null, correcta: "A", area: "Inglés" },
  { numero: 102, enunciado: "Today, Martina feels the ________ person on the planet.", contexto: CONTEXTO_REPAIR, opcionA: "lucky", opcionB: "luckier", opcionC: "luckiest", opcionD: null, opcionE: null, opcionF: null, opcionG: null, opcionH: null, correcta: "C", area: "Inglés" },

  // ── PARTE 5: Writers lectura A/B/C (103-109) ───────────────────────────
  { numero: 103, enunciado: "Mike remembered Ana because of...", contexto: CONTEXTO_WRITERS, opcionA: "Her usual daily actions.", opcionB: "A song he listened to.", opcionC: "His partner's routine.", opcionD: null, opcionE: null, opcionF: null, opcionG: null, opcionH: null, correcta: "C", area: "Inglés" },
  { numero: 104, enunciado: "Mike says that Ana...", contexto: CONTEXTO_WRITERS, opcionA: "Always woke up early.", opcionB: "Missed her morning alarms.", opcionC: "Practiced jazz very loud.", opcionD: null, opcionE: null, opcionF: null, opcionG: null, opcionH: null, correcta: "A", area: "Inglés" },
  { numero: 105, enunciado: "Before noon Ana played jazz while...", contexto: CONTEXTO_WRITERS, opcionA: "Having a meal.", opcionB: "Practicing sports.", opcionC: "Writing down ideas.", opcionD: null, opcionE: null, opcionF: null, opcionG: null, opcionH: null, correcta: "C", area: "Inglés" },
  { numero: 106, enunciado: "Ana finishes exercising around...", contexto: CONTEXTO_WRITERS, opcionA: "6 pm.", opcionB: "8 pm.", opcionC: "10 pm.", opcionD: null, opcionE: null, opcionF: null, opcionG: null, opcionH: null, correcta: "B", area: "Inglés" },
  { numero: 107, enunciado: "As soon as Mike gets up he starts...", contexto: CONTEXTO_WRITERS, opcionA: "Planning his opinions.", opcionB: "Writing the news.", opcionC: "Checking his appointments.", opcionD: null, opcionE: null, opcionF: null, opcionG: null, opcionH: null, correcta: "C", area: "Inglés" },
  { numero: 108, enunciado: "Mike goes out at night so that he can...", contexto: CONTEXTO_WRITERS, opcionA: "Work on his mobile.", opcionB: "Get ideas for articles.", opcionC: "Meet his family members.", opcionD: null, opcionE: null, opcionF: null, opcionG: null, opcionH: null, correcta: "B", area: "Inglés" },
  { numero: 109, enunciado: "How often does Mike's girlfriend meet with him at his place?", contexto: CONTEXTO_WRITERS, opcionA: "Weekly.", opcionB: "Monthly.", opcionC: "Daily.", opcionD: null, opcionE: null, opcionF: null, opcionG: null, opcionH: null, correcta: "A", area: "Inglés" },

  // ── PARTE 6: Lost City lectura A/B/C/D (110-114) ───────────────────────
  { numero: 110, enunciado: "What is the writer doing in this article?", contexto: CONTEXTO_LOST_CITY, opcionA: "Warning tourists of the dangers of illnesses in Santa Marta.", opcionB: "Showing how interesting an expedition to the Lost City can be.", opcionC: "Encouraging readers to visit her friends in Santa Marta.", opcionD: "Comparing the size of Machu Picchu with that of the Lost City.", opcionE: null, opcionF: null, opcionG: null, opcionH: null, correcta: "B", area: "Inglés" },
  { numero: 111, enunciado: "When describing the first part of her journey, the writer thinks that...", contexto: CONTEXTO_LOST_CITY, opcionA: "The tour guide was the strongest in the group.", opcionB: "The coast weather cured her illness.", opcionC: "Walking was the most valuable adventure for her.", opcionD: "Moving slowly was the only way to cross the mountain.", opcionE: null, opcionF: null, opcionG: null, opcionH: null, correcta: "C", area: "Inglés" },
  { numero: 112, enunciado: "In paragraph 3, the writer says that she...", contexto: CONTEXTO_LOST_CITY, opcionA: "Really enjoyed the sunny, hot weather there.", opcionB: "Was grateful to chefs who had dinner prepared on time.", opcionC: "Was an expert on the natural world, especially on butterflies.", opcionD: "Refused to eat oranges and pineapple while walking.", opcionE: null, opcionF: null, opcionG: null, opcionH: null, correcta: "B", area: "Inglés" },
  { numero: 113, enunciado: "Regarding the local people, the writer...", contexto: CONTEXTO_LOST_CITY, opcionA: "Prefers children's behavior to adults behavior.", opcionB: "Feels amazed by the way they feel they protect the planet.", opcionC: "Considers she deserves a photo of herself with everyone.", opcionD: "Thinks that children are the ones who should protect the environment.", opcionE: null, opcionF: null, opcionG: null, opcionH: null, correcta: "B", area: "Inglés" },
  { numero: 114, enunciado: "Which of the following could be a note for tourists?", contexto: CONTEXTO_LOST_CITY, opcionA: "Be prepared to be delighted of this magnificent place full of natural surprises.", opcionB: "This fantastic plan requires only curious, healthy, and brave explorers.", opcionC: "Feel free to put all the personal things you may need into your backpack.", opcionD: "This is an incredible opportunity to taste a few typical snacks from this region.", opcionE: null, opcionF: null, opcionG: null, opcionH: null, correcta: "A", area: "Inglés" },

  // ── PARTE 7: Dogs gap-fill A/B/C/D (115-124) ───────────────────────────
  { numero: 115, enunciado: "Some dogs had to go into an M.R.I scanner ________ awake.", contexto: CONTEXTO_DOGS, opcionA: "directly", opcionB: "totally", opcionC: "exactly", opcionD: "especially", opcionE: null, opcionF: null, opcionG: null, opcionH: null, correcta: "A", area: "Inglés" },
  { numero: 116, enunciado: "We wanted to ________ how dog brains work.", contexto: CONTEXTO_DOGS, opcionA: "discover", opcionB: "receive", opcionC: "accept", opcionD: "require", opcionE: null, opcionF: null, opcionG: null, opcionH: null, correcta: "A", area: "Inglés" },
  { numero: 117, enunciado: "An M.R.I scanner can ________ information about their thoughts.", contexto: CONTEXTO_DOGS, opcionA: "feed", opcionB: "serve", opcionC: "afford", opcionD: "provide", opcionE: null, opcionF: null, opcionG: null, opcionH: null, correcta: "D", area: "Inglés" },
  { numero: 118, enunciado: "The dog owners agreed to this by ________ a contract.", contexto: CONTEXTO_DOGS, opcionA: "achieving", opcionB: "signing", opcionC: "recording", opcionD: "registering", opcionE: null, opcionF: null, opcionG: null, opcionH: null, correcta: "B", area: "Inglés" },
  { numero: 119, enunciado: "In the study, we used positive training ________.", contexto: CONTEXTO_DOGS, opcionA: "tracks", opcionB: "recipes", opcionC: "methods", opcionD: "arrangements", opcionE: null, opcionF: null, opcionG: null, opcionH: null, correcta: "C", area: "Inglés" },
  { numero: 120, enunciado: "The dogs could leave the scanner ________ they wanted.", contexto: CONTEXTO_DOGS, opcionA: "whenever", opcionB: "whatever", opcionC: "wherever", opcionD: "whoever", opcionE: null, opcionF: null, opcionG: null, opcionH: null, correcta: "A", area: "Inglés" },
  { numero: 121, enunciado: "My dog Lassie, which was ________ by a homeless dog charity, was the first.", contexto: CONTEXTO_DOGS, opcionA: "approached", opcionB: "caught", opcionC: "rescued", opcionD: "stolen", opcionE: null, opcionF: null, opcionG: null, opcionH: null, correcta: "C", area: "Inglés" },
  { numero: 122, enunciado: "This was a great ________ for our effort.", contexto: CONTEXTO_DOGS, opcionA: "earning", opcionB: "effect", opcionC: "reward", opcionD: "wage", opcionE: null, opcionF: null, opcionG: null, opcionH: null, correcta: "C", area: "Inglés" },
  { numero: 123, enunciado: "We ________ the similarity between dogs and humans in an important brain region.", contexto: CONTEXTO_DOGS, opcionA: "solved", opcionB: "discovered", opcionC: "answered", opcionD: "designed", opcionE: null, opcionF: null, opcionG: null, opcionH: null, correcta: "B", area: "Inglés" },
  { numero: 124, enunciado: "________ these facts about the canine brain are limited, they cannot be ignored.", contexto: CONTEXTO_DOGS, opcionA: "If", opcionB: "Till", opcionC: "Unless", opcionD: "Although", opcionE: null, opcionF: null, opcionG: null, opcionH: null, correcta: "D", area: "Inglés" },
];

async function main() {
  console.log(`\nActualizando ${ACTUALIZACIONES.length} preguntas de Inglés (S2, Simulacro 2)...\n`);

  for (const upd of ACTUALIZACIONES) {
    const p = await prisma.preguntaExamen.findFirst({
      where: { examenId: 2, sesion: 2, numero: upd.numero },
      select: { id: true },
    });

    if (!p) {
      console.log(`  ⚠ Pregunta ${upd.numero} no encontrada en DB — saltando`);
      continue;
    }

    await prisma.preguntaExamen.update({
      where: { id: p.id },
      data: {
        enunciado:  upd.enunciado,
        contexto:   upd.contexto,
        opcionA:    upd.opcionA,
        opcionB:    upd.opcionB,
        opcionC:    upd.opcionC,
        opcionD:    upd.opcionD ?? null,
        opcionE:    upd.opcionE ?? null,
        opcionF:    upd.opcionF ?? null,
        opcionG:    upd.opcionG ?? null,
        opcionH:    upd.opcionH ?? null,
        correcta:   upd.correcta,
        area:       upd.area,
      },
    });
    process.stdout.write(`  ✓ Pregunta ${upd.numero}\n`);
  }

  console.log(`\n✅ Listo.\n`);
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
