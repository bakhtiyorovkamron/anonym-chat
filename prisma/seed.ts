import { PrismaClient, Gender, GenderPreference, Language, Mode } from "@prisma/client";

const prisma = new PrismaClient();

const users = [
  {
    anonymousId: "anon_luna",
    age: 24,
    gender: Gender.FEMALE,
    preferredGender: GenderPreference.ANY,
    language: Language.RUSSIAN,
    persona: { nickname: "Luna", age: 24, interests: ["Музыка", "Кино", "Путешествия"], mode: Mode.ROLEPLAY },
  },
  {
    anonymousId: "anon_alex",
    age: 27,
    gender: Gender.MALE,
    preferredGender: GenderPreference.FEMALE,
    language: Language.RUSSIAN,
    persona: { nickname: "Alex", age: 27, interests: ["Знакомства", "Игры", "Мемы"], mode: Mode.FLIRT },
  },
  {
    anonymousId: "anon_mira",
    age: 22,
    gender: Gender.FEMALE,
    preferredGender: GenderPreference.MALE,
    language: Language.UZBEK,
    persona: { nickname: "Mira", age: 22, interests: ["Общение", "Музыка", "Отношения"], mode: Mode.DATE },
  },
  {
    anonymousId: "anon_night",
    age: 31,
    gender: Gender.OTHER,
    preferredGender: GenderPreference.ANY,
    language: Language.ENGLISH,
    persona: { nickname: "Night", age: 31, interests: ["Talk", "Games", "Memes"], mode: Mode.TALK },
  },
  {
    anonymousId: "anon_timur",
    age: 29,
    gender: Gender.MALE,
    preferredGender: GenderPreference.ANY,
    language: Language.UZBEK,
    persona: { nickname: "Timur", age: 29, interests: ["Flirt", "Travel", "Roleplay"], mode: Mode.COMPANY },
  },
  {
    anonymousId: "anon_emma",
    age: 25,
    gender: Gender.FEMALE,
    preferredGender: GenderPreference.ANY,
    language: Language.ENGLISH,
    persona: { nickname: "Emma", age: 25, interests: ["Movies", "Night talks", "Dating"], mode: Mode.DATE },
  },
];

async function main() {
  await prisma.message.deleteMany();
  await prisma.report.deleteMany();
  await prisma.block.deleteMany();
  await prisma.match.deleteMany();
  await prisma.persona.deleteMany();
  await prisma.searchQueue.deleteMany();
  await prisma.admin.deleteMany();
  await prisma.user.deleteMany();

  for (const entry of users) {
    const user = await prisma.user.create({
      data: {
        anonymousId: entry.anonymousId,
        age: entry.age,
        gender: entry.gender,
        preferredGender: entry.preferredGender,
        language: entry.language,
        online: true,
      },
    });

    await prisma.persona.create({
      data: {
        userId: user.id,
        nickname: entry.persona.nickname,
        age: entry.persona.age,
        interests: entry.persona.interests,
        mode: entry.persona.mode,
        active: true,
      },
    });
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
