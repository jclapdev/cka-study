/** The first lesson of every topic, which opens at the topic's own address. */
export const INTRO = "introduction";

export const lessonHref = (topic: string, lesson: string) => (lesson === INTRO ? `/t/${topic}` : `/t/${topic}/${lesson}`);
