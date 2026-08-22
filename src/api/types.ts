/**
 * The backend's wire shapes, mirrored.
 *
 * Source of truth: `app/schemas.py` in `Calder35/youdecide-ai-backend`. These
 * are hand-mirrored rather than generated, so they carry a comment naming what
 * they mirror — when the backend adds a field, this is where it lands.
 */

/** POST /v1/users */
export type CreateUserRequest = {
  email: string;
  display_name: string;
  role: 'seller' | 'agent' | 'staff';
};

export type UserResponse = {
  id: string;
  email: string;
  display_name: string;
  role: string;
};

/** POST /v1/users/{user_id}/consents */
export type GrantConsentRequest = {
  scope: string;
  /** Whatever proves the grant — we send the exact wording shown on screen. */
  evidence: string;
  method: string;
};

export type ConsentResponse = {
  id: string;
  user_id: string;
  scope: string;
  /** The wording version the backend recorded the grant under. */
  text_version: string;
  active: boolean;
};

/** POST /v1/journeys */
export type PropertyRequest = {
  line1: string;
  line2: string;
  city: string;
  state: string;
  postal_code: string;
  apn: string;
};

export type CreateWorkspaceRequest = {
  property: PropertyRequest;
  kind: 'list' | 'buy' | 'research';
};

export type JourneyResponse = {
  id: string;
  property_id: string;
  owner_user_id: string;
  kind: string;
  status: string;
  consent_id: string;
};

/** POST /v1/journeys/{journey_id}/human-help */
export type HumanHelpRequest = {
  reason: string;
  /** True when the law requires a licensee, not merely that a person look. */
  licensed_required: boolean;
};

export type HumanInterventionResponse = {
  id: string;
  journey_id: string;
  reason: string;
  licensed_required: boolean;
  status: string;
};

/** GET /v1/journeys/{journey_id}/audit */
export type AuditEntryResponse = {
  seq: number;
  action: string;
  entity_type: string;
  entity_id: string;
  actor_user_id: string | null;
  journey_id: string | null;
};

/** GET /health */
export type HealthResponse = {
  status: string;
  service: string;
  sierra_mode: string;
};
