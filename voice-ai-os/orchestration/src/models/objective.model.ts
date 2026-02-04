/**
 * Objective Model - Layer 2: Orchestration
 * 
 * Objectives declare WHAT to capture (not HOW).
 * Following R-ARCH-003: Objectives MUST Be Declarative (Not Imperative)
 */

/**
 * Objective State Machine (P-5: State Machine for Objective Execution)
 * PENDING → ELICITING → CAPTURED → CONFIRMING → CONFIRMED → COMPLETED
 */
export enum ObjectiveState {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
  SKIPPED = 'skipped'
}

/**
 * Primitive Types (immutable across customers)
 * V1 primitives: Australian-first (D-ARCH-003)
 */
export enum PrimitiveType {
  // Australian primitives (V1)
  CAPTURE_EMAIL_AU = 'capture_email_au',
  CAPTURE_PHONE_AU = 'capture_phone_au',
  CAPTURE_ADDRESS_AU = 'capture_address_au',
  CAPTURE_NAME_AU = 'capture_name_au',
  CAPTURE_DATE_AU = 'capture_date_au',
  CAPTURE_TIME_AU = 'capture_time_au',
  CAPTURE_DATETIME_AU = 'capture_datetime_au',
  
  // Generic primitives
  CAPTURE_YES_NO = 'capture_yes_no',
  CAPTURE_NUMBER = 'capture_number',
  GREETING_AU = 'greeting_au',
  FAREWELL_AU = 'farewell_au'
}

/**
 * Escalation strategies when objective fails
 */
export enum EscalationStrategy {
  TRANSFER = 'transfer',        // Transfer to human
  SKIP = 'skip',                // Skip objective, continue
  RETRY = 'retry',              // Retry objective
  ABORT = 'abort'               // Abort conversation
}

/**
 * Objective definition (declarative)
 * Following Architecture Laws: Objectives declare WHAT, not HOW
 */
export interface Objective {
  /** Unique identifier for this objective */
  id: string;
  
  /** Primitive reference (e.g., "capture_email_au@v1") */
  type: PrimitiveType;
  
  /** Version of the primitive (semver) */
  version?: string;
  
  /** Purpose of capturing this information (for LLM context) */
  purpose: string;
  
  /** Whether this objective is required to complete the conversation */
  required: boolean;
  
  /** Maximum attempts before escalation */
  max_retries?: number;
  
  /** Next objective to execute on success */
  on_success?: string;
  
  /** Next objective to execute on failure */
  on_failure?: string;
  
  /** Escalation strategy if max retries exhausted */
  escalation?: EscalationStrategy;
  
  /** Metadata for the objective */
  metadata?: Record<string, unknown>;
}

/**
 * Objective instance (runtime state)
 * Event-sourced: State reconstructed from events
 */
export interface ObjectiveInstance {
  /** Objective definition reference */
  objective_id: string;
  
  /** Current state */
  state: ObjectiveState;
  
  /** Attempt count */
  attempts: number;
  
  /** Captured data (if completed) */
  data?: Record<string, unknown>;
  
  /** Error information (if failed) */
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  
  /** Timestamps */
  started_at?: Date;
  completed_at?: Date;
  failed_at?: Date;
}

/**
 * Objective Graph (DAG)
 * D-ARCH-005: Objective Graph is Directed Acyclic Graph
 */
export interface ObjectiveGraph {
  /** Root objective (entry point) */
  root: string;
  
  /** All objectives in the graph */
  objectives: Record<string, Objective>;
}
