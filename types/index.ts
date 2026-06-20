export type EmailCategory =
  | "newsletter"
  | "job"
  | "finance"
  | "notification"
  | "personal"
  | "work";

export const EMAIL_CATEGORIES: EmailCategory[] = [
  "newsletter",
  "job",
  "finance",
  "notification",
  "personal",
  "work",
];

export const CATEGORY_LABELS: Record<EmailCategory, string> = {
  newsletter: "Newsletters",
  job: "Job / Recruitment",
  finance: "Finance",
  notification: "Notifications",
  personal: "Personal",
  work: "Work / Professional",
};

export const CATEGORY_COLORS: Record<EmailCategory, string> = {
  newsletter: "var(--cat-newsletter)",
  job: "var(--cat-job)",
  finance: "var(--cat-finance)",
  notification: "var(--cat-notification)",
  personal: "var(--cat-personal)",
  work: "var(--cat-work)",
};

export interface Citation {
  email_id: string;
  thread_id: string;
  sender: string;
  subject: string;
  date: string;
  snippet: string;
  tag?: string;
}

export interface Thread {
  id: string;
  user_id: string;
  gmail_thread_id: string;
  subject: string | null;
  participant_emails: string[] | null;
  message_count: number;
  category: EmailCategory | null;
  thread_summary: string | null;
  last_message_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Email {
  id: string;
  user_id: string;
  thread_id: string;
  gmail_message_id: string;
  from_email: string | null;
  from_name: string | null;
  to_emails: string[] | null;
  subject: string | null;
  snippet: string | null;
  body_text: string | null;
  body_html: string | null;
  headers: Record<string, string> | null;
  category: EmailCategory | null;
  category_confidence: number | null;
  summary: string | null;
  is_unread: boolean;
  is_sent: boolean;
  is_inbox: boolean;
  received_at: string | null;
  created_at: string;
}

export interface ChatMessage {
  id: string;
  session_id: string;
  role: "user" | "assistant";
  content: string;
  citations: Citation[] | null;
  created_at: string;
}

export interface SyncJobProgress {
  done: boolean;
  processed_count: number;
  total_estimate: number | null;
  status: string;
  error?: string;
}
