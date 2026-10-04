// Sample study material for the test account (written for this project).
import type { SubjectColour } from '@studyapp/shared';

export const SAMPLE_SUBJECTS: { name: string; colour: SubjectColour }[] = [
  { name: 'Biology 101', colour: 'emerald' },
  { name: 'History', colour: 'amber' },
];

type SampleDocument = { title: string; fileName: string; subject?: string; tags: string[]; content: string };

export const SAMPLE_DOCUMENTS: SampleDocument[] = [
  {
    title: 'Cell Biology Basics',
    fileName: 'Cell Biology Basics.md',
    subject: 'Biology 101',
    tags: ['exam', 'cells'],
    content: `# Cell Biology Basics

## What is a cell?
The cell is the smallest unit of life. All living things are made of one or more cells, and every cell comes from an existing cell.

## Prokaryotic and eukaryotic cells
Prokaryotic cells (bacteria and archaea) have no nucleus; their DNA floats in the cytoplasm. Eukaryotic cells (plants, animals, fungi) keep their DNA inside a nucleus and have membrane-bound organelles.

## Key organelles
- Nucleus: stores DNA and controls the cell's activities.
- Mitochondria: release energy from glucose through cellular respiration, producing ATP.
- Ribosomes: build proteins from amino acids.
- Endoplasmic reticulum: rough ER helps make proteins; smooth ER makes lipids.
- Golgi apparatus: packages and ships proteins.
- Cell membrane: a phospholipid bilayer that controls what enters and leaves the cell.
- Chloroplasts (plants only): carry out photosynthesis.
- Cell wall (plants, fungi, bacteria): gives structure and support.

## Moving substances
Diffusion moves particles from high to low concentration without energy. Osmosis is the diffusion of water across a partially permeable membrane. Active transport moves particles against the concentration gradient and needs ATP.`,
  },
  {
    title: 'Photosynthesis',
    fileName: 'Photosynthesis.md',
    subject: 'Biology 101',
    tags: ['exam'],
    content: `# Photosynthesis

Plants make their own food using light energy. The overall equation is:
carbon dioxide + water → glucose + oxygen (in the presence of light and chlorophyll).

## Where it happens
Photosynthesis happens in chloroplasts, mostly in the palisade cells of the leaf. Chlorophyll absorbs red and blue light and reflects green light.

## Two stages
1. Light-dependent reactions (thylakoid membranes): light splits water, releasing oxygen and making ATP and NADPH.
2. Light-independent reactions, or the Calvin cycle (stroma): ATP and NADPH are used to fix carbon dioxide into glucose.

## Limiting factors
The rate of photosynthesis is limited by light intensity, carbon dioxide concentration and temperature. Whichever factor is in shortest supply limits the rate.`,
  },
  {
    title: 'Causes of World War I',
    fileName: 'Causes of World War I.md',
    subject: 'History',
    tags: ['essay'],
    content: `# Causes of World War I (1914–1918)

A useful way to remember the long-term causes is MAIN:

- Militarism: European powers built up large armies and navies; Britain and Germany raced to build battleships.
- Alliances: Europe split into the Triple Entente (Britain, France, Russia) and the Triple Alliance (Germany, Austria-Hungary, Italy), so a local conflict could pull in every major power.
- Imperialism: competition for colonies, especially in Africa, increased rivalry and distrust.
- Nationalism: strong national pride, and independence movements in the Balkans, raised tensions.

## The trigger
On 28 June 1914, Archduke Franz Ferdinand of Austria-Hungary was assassinated in Sarajevo by Gavrilo Princip, a Bosnian Serb nationalist. Austria-Hungary declared war on Serbia, and the alliance system turned it into a European war within weeks.

## Essay tip
Argue which cause mattered most and why, rather than just listing them. Link each cause back to the question.`,
  },
  {
    title: 'How to study with StudyApp',
    fileName: 'How to study with StudyApp.txt',
    tags: [],
    content: `How to study with StudyApp

1. Upload your study guides (PDF, Word, text or Markdown) and file them into subjects.
2. Tag them (for example "exam" or "essay") so you can filter quickly.
3. Use the search box to find any word across all your documents.
4. Coming soon: AI summaries, AI-generated flashcards and spaced-repetition review.

Tip: study in short sessions of 25 minutes with a 5-minute break, and test yourself instead of re-reading.`,
  },
];
