import type { ChatMessage } from "~/routes";

export const examples: ChatMessage[] = [
  {
    time: Date.now(),
    role: "assistant",
    content: () => "Hi there!",
    done: () => true,
    error: () => null,
    retry: () => {}
  },
  {
    time: Date.now(),
    role: "user",
    content: "Give me 3 ideas about how to plan good New Years resolutions. Give me some that are personal, family, and professionally-oriented."
  },
  {
    time: Date.now(),
    role: "assistant",
    content: () => "Certainly! Here are three ideas for New Year's resolutions, each tailored to personal, family, and professional aspects of life:\n\n1. **Personal:**\n   - **Mindfulness Practice:** Resolve to incorporate mindfulness into your daily routine. This could involve starting each morning with a few minutes of meditation or mindfulness exercises. Practicing mindfulness can help reduce stress, improve focus, and promote overall well-being.\n   - **Healthy Lifestyle Changes:** Commit to making healthier lifestyle choices, such as improving your diet, exercising regularly, getting enough sleep, and staying hydrated. Set specific, achievable goals for each aspect of your health and track your progress throughout the year.\n   - **Skill Development:** Choose a new skill or hobby you've been wanting to learn and dedicate time each week to developing it. Whether it's learning a new language, playing a musical instrument, or mastering a craft, challenging yourself intellectually can be both rewarding and fulfilling.\n\n2. **Family:**\n   - **Quality Time Together:** Make a resolution to prioritize spending quality time with your family. This could involve scheduling regular family game nights, cooking meals together, or planning weekend outings or vacations. Building strong bonds and creating lasting memories with your loved ones can enrich your relationships and bring you closer together.\n   - **Communication Improvement:** Resolve to improve communication within your family. This might involve setting aside time each week for family meetings to discuss important topics, actively listening to each other's perspectives, and expressing appreciation and support for one another.\n   - **Volunteer Together:** Make a resolution to give back to your community as a family. Choose a cause or organization that you're passionate about and volunteer your time and talents together. Whether it's serving meals at a local shelter, participating in environmental clean-up efforts, or organizing a charity fundraiser, working together for the greater good can strengthen your family bonds and instill a sense of empathy and altruism in your children.\n\n3. **Professional:**\n   - **Career Advancement Goals:** Set specific, achievable goals for your career advancement. This could include pursuing additional education or certifications, taking on leadership roles or new responsibilities at work, or networking and seeking out mentorship opportunities in your field.\n   - **Work-Life Balance:** Make a resolution to achieve better work-life balance. Set boundaries around your work hours, prioritize self-care activities outside of work, and delegate tasks when necessary to avoid burnout and maintain your overall well-being.\n   - **Professional Development Plan:** Create a plan for ongoing professional development and growth. Identify areas where you want to improve your skills or knowledge, seek out relevant training or workshops, and set aside time each week for focused learning and development activities. Regularly review and revise your plan to ensure that you're staying on track toward your professional goals.",
    done: () => true,
    error: () => null,
    retry: () => {}
  },
  {
    time: Date.now(),
    role: "assistant",
    content: () => "Personal:\n1. Set specific and achievable goals: Consider what personal improvements you would like to make, such as health and fitness, education, or hobbies. Break down these objectives into small, actionable steps to make them more achievable throughout the year.\n2. Reflect on the past year: Take time to reflect on the successes and challenges of the past year. Use this reflection to identify areas for growth and improvement in the coming year, and use this insight to guide your resolutions.\n3. Create a support system: Share your resolutions with friends or family, or consider finding a mentor to help hold you accountable and provide support throughout the year.\n\nFamily:\n1. Schedule regular family meetings: Plan regular meetings with your family to discuss individual and collective goals for the upcoming year. This can include activities, educational pursuits, or plans for spending quality time together.\n2. Collaborate on shared resolutions: Encourage family members to identify common goals and resolutions that can be pursued together. This could be anything from volunteering as a family, to planning a vacation, or improving communication and support within the family unit.\n3. Establish rituals and traditions: Consider incorporating new traditions and rituals into your family's routine that can help support and reinforce your collective resolutions. This could be a weekly game night, a monthly family outing, or a yearly family retreat.\n\nProfessionally-oriented:\n1. Set measurable and relevant goals: Define specific professional objectives, such as skill development, career advancement, or work-life balance. Choose goals that are relevant to your career aspirations and can be measured over time.\n2. Create a development plan: Outline a structured plan for achieving your professional resolutions, including specific actions, timelines, and resources needed. This may involve seeking additional training, networking, or setting benchmarks for career advancement.\n3. Seek feedback and mentorship: Reach out to colleagues, supervisors, or industry professionals for feedback and mentorship as you work towards your professional resolutions. This can help you gain support, guidance, and new perspectives to aid in your professional growth.",
    done: () => true,
    error: () => null,
    retry: () => {}
  }
]