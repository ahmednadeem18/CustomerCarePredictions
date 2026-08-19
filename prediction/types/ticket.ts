export type TicketStatus =
  | "open"
  | "in_progress"
  | "director_review"
  | "closed";

export type Ticket = {
  id: number;

  customer_name: string;
  customer_email: string;
  customer_phone?: string | null;
  order_number?: string | null;

  question: string;

  ai_department_id: number | null;
  ai_department_name?: string | null;

  ai_confidence: number | null;
  ai_model_version: number | null;

  current_department_id: number | null;
  current_department_name?: string | null;

  final_department_id: number | null;
  final_department_name?: string | null;

  status: TicketStatus;

  response?: string | null;

  accepted_by?: number | null;

  created_at: string;
  updated_at: string;
  closed_at?: string | null;
};

export type TicketHistory = {
  id: number;

  ticket_id: number;

  action: string;

  from_department_id?: number | null;
  from_department_name?: string | null;

  to_department_id?: number | null;
  to_department_name?: string | null;

  performed_by?: number | null;
  performed_by_name?: string | null;

  response?: string | null;

  note?: string | null;

  created_at: string;
};

export type Department = {
  id: number;
  name: string;
};

export type User = {
  id: number;
  name: string;
  email: string;
  role: "customer" | "department" | "director";
  department_id?: number | null;
  department_name?: string | null;
};