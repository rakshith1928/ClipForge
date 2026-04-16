export type Clip = {
  id: string;
  title: string;
  viralScore: number;
  duration: string;      // Formatted display string e.g. "1:23 - 2:05"
  startTime: number;     // Raw seconds for backend generate call
  endTime: number;       // Raw seconds for backend generate call
  summary: string;
  originalHook: string;
  aiHook: string;
  clipType?: string;    // e.g. Insight, Story, Revelation
  whyViral?: string;    // AI reasoning
  previewAudioUrl?: string;
  imageUrl?: string;
};

export const analysisTopics = [
  "Machine Learning",
  "Societal Impact",
  "Neural Networks",
  "Silicon Photonics"
];

export const mockEpisodeMetadata = {
  title: "The Future of Generative AI",
  summary: "A deep dive into the architectural shifts defining the next decade of Silicon Valley and global compute power."
};

export const mockClips: Clip[] = [
  {
    id: "clip-1",
    title: "Defining the AGI Era",
    viralScore: 98,
    duration: "0:45 - 1:15",
    startTime: 45,
    endTime: 75,
    summary: "Sam Altman explains the distinction between narrow AI and the emergent capabilities that define the transition to true Artificial General Intelligence.",
    originalHook: "So we were talking about what AGI actually means in the current context...",
    aiHook: "The definition of AGI is changing. Here is why the next 12 months matter more than the last 10 years."
  },
  {
    id: "clip-2",
    title: "Hardware Bottlenecks",
    viralScore: 82,
    duration: "14:20 - 15:05",
    startTime: 860,
    endTime: 905,
    summary: "Analysis of the global GPU shortage and how architectural optimizations are becoming the new competitive edge over raw compute power.",
    originalHook: "One of the things that people don't talk about is the hardware...",
    aiHook: "Why computation limits might throttle AI progress sooner than you think.",
    imageUrl: "https://lh3.googleusercontent.com/aida-public/AB6AXuDcCOHRpQ7DRGxTulKJr7SLJ5KfqIKcriH8zMYS7cgE19hSRs2OSPYBhbR6D0kBgRG5mvu6bjQRTdEyOcaZykvRNxakTNF-OZhIeddQbtGoFSez8pARfxa-fKGv1a_Vi94ZayFYyTsCEsEFZga41OYrhWaxIZTaaOZqTRX9MNHzkfw8HrSqA16f1fqAsNYupNNo1iaKnckaoxr0qHHUL2Y1d9iTVslWDeXFEPpzfB5vUHZUekQHnmsi1VLRbmxG6U8qLLupYWx45yY"
  }
];
