import { createObjectsClient } from './objects.js';
import type { ObjectsClient } from './objects.js';
import { createSubscriber } from './subscribe.js';
import type { SubscribeOptions, Subscription } from './subscribe.js';
import { createMetadataClient } from './metadata.js';
import type { MetadataClient, PermissionsResult } from './metadata.js';
import { createAuditClient } from './audit.js';
import type { AuditClient } from './audit.js';
import { createApprovalsClient } from './approvals.js';
import type { ApprovalsClient } from './approvals.js';
import { createScriptsClient } from './scripts.js';
import type { ScriptsClient } from './scripts.js';
import { createLayoutsClient } from './layouts.js';
import type { LayoutsClient } from './layouts.js';
import { createSchemaClient } from './schema.js';
import type { SchemaClient } from './schema.js';
import { createGuardrailsClient } from './guardrails.js';
import type { GuardrailsClient } from './guardrails.js';
import { createIdentitiesClient } from './identities.js';
import type { IdentitiesClient } from './identities.js';

export const version = '0.4.0';

export interface ClientOptions {
  /** engine base URL, e.g. `http://localhost:3000` */
  baseUrl: string;
  /** REST route prefix; defaults to `/api` */
  prefix?: string;
  /** API key sent as `Authorization: Bearer <apiKey>` */
  apiKey?: string;
  /** fetch implementation; defaults to the global fetch (inject for testing / custom transport) */
  fetch?: typeof fetch;
}

export interface Client {
  /**
   * typed CRUD handle for an object collection. Pass the object's generated
   * type (from `generated/types.ts`) for object-level type safety:
   * `objects<Lead>('lead')`.
   */
  objects<T = Record<string, unknown>>(name: string): ObjectsClient<T>;
  /** rotate the API key (login/logout); subsequent requests and subscriptions use it */
  setApiKey(apiKey?: string): void;
  /**
   * Derive a client that shares this client's baseUrl + fetch but uses a
   * different REST prefix and/or key. Used to reach the engine's generic proxy —
   * one governance client can produce per-instance `/api/proxy/:id` sub-clients
   * without ever holding a customer-engine key in the browser.
   */
  derive(options?: { prefix?: string; apiKey?: string }): Client;
  /** schema + permissions metadata (M11): what this identity can read / do */
  metadata: MetadataClient;
  /** effective permissions per object (shorthand for `metadata.permissions()`) */
  permissions(): Promise<PermissionsResult>;
  /** audit trail query (M11): own actor by default */
  audit: AuditClient;
  /** approval queue (D1): list/approve/reject — admin-gated by the engine */
  approvals: ApprovalsClient;
  /** client-side script source (`*.client.js`) per object — engine serves, frontend executes */
  scripts: ScriptsClient;
  /** page-layout source (path-mirrored addressing) — engine serves, frontend interprets */
  layouts: LayoutsClient;
  /** raw object schema source (admin read/write) — engine serves, ObjectDesigner edits */
  schema: SchemaClient;
  /** guardrail policy source (admin read/write) — engine project `policies/` dir */
  guardrails: GuardrailsClient;
  /** MCP on-behalf-of identity directory (admin read) */
  identities: IdentitiesClient;
  /**
   * Live event subscription (M12): SSE stream of record/audit/schema changes,
   * filtered server-side by the identity's RBAC. Auto-reconnects with backoff
   * and replays missed events via `Last-Event-ID`. Returns a handle to close.
   */
  subscribe(options: SubscribeOptions): Subscription;
}

/**
 * Create a WeaveKit client. Framework-agnostic, no DOM dependency — usable in
 * browsers, Node, or anywhere a `fetch` implementation exists.
 */
export function createClient(options: ClientOptions): Client {
  const http = {
    baseUrl: options.baseUrl.replace(/\/+$/, ''),
    prefix: options.prefix ?? '/api',
    apiKey: options.apiKey,
    fetchImpl: options.fetch ?? fetch,
  };
  const metadata = createMetadataClient(http);
  return {
    objects<T = Record<string, unknown>>(name: string): ObjectsClient<T> {
      return createObjectsClient<T>(http, name);
    },
    setApiKey(apiKey?: string): void {
      http.apiKey = apiKey;
    },
    derive(overrides?: { prefix?: string; apiKey?: string }): Client {
      return createClient({
        baseUrl: http.baseUrl,
        prefix: overrides?.prefix ?? http.prefix,
        apiKey: overrides?.apiKey ?? http.apiKey,
        fetch: http.fetchImpl,
      });
    },
    metadata,
    permissions(): Promise<PermissionsResult> {
      return metadata.permissions();
    },
    audit: createAuditClient(http),
    approvals: createApprovalsClient(http),
    scripts: createScriptsClient(http),
    layouts: createLayoutsClient(http),
    schema: createSchemaClient(http),
    guardrails: createGuardrailsClient(http),
    identities: createIdentitiesClient(http),
    subscribe(options: SubscribeOptions): Subscription {
      return createSubscriber(http)(options);
    },
  };
}

export type { ObjectsClient } from './objects.js';
export type { FindParams, FindOneParams, FindSort } from './types.js';
export type { LiveEvent, SubscribeOptions, Subscription } from './subscribe.js';
export type { MetadataClient, PermissionsResult } from './metadata.js';
export type { AuditClient, AuditResult } from './audit.js';
export type { ApprovalsClient, ApprovalListFilter, ApprovalListResult, ApprovalDecisionResult } from './approvals.js';
export type {
  ScriptSaveOptions,
  ScriptSaveResult,
  ScriptSourceDocument,
  ScriptSourceOptions,
  ScriptsClient,
} from './scripts.js';
export type { LayoutsClient } from './layouts.js';
export type {
  SourceDocument,
  PageSummary,
  CreatePageOptions,
  CreatePageResult,
  RenamePageOptions,
  RenamePageResult,
  DeletePageOptions,
  DeletePageResult,
  DesignSaveOptions,
  DesignSavePart,
  DesignSaveResult,
  LayoutSaveOptions,
  LayoutSaveResult,
  LayoutSourceOptions,
} from './layouts.js';
export type { SchemaClient, SchemaSourceDocument, SchemaSourceOptions, SchemaSaveOptions, SchemaSaveResult } from './schema.js';
export type {
  GuardrailsClient,
  GuardrailPolicySummary,
  GuardrailPolicySource,
  GuardrailPolicyCommit,
  GuardrailPolicyHistory,
  GuardrailSourceOptions,
  GuardrailSaveOptions,
  GuardrailListResult,
  GuardrailSaveResult,
} from './guardrails.js';
export type { IdentitiesClient, IdentitySummary, IdentitiesListResult } from './identities.js';
export { layoutPagePath } from './layouts.js';
export type { AuditEvent, AuditQuery } from '@weave-kit/engine';
export type { PendingApproval, ApprovalStatus } from '@weave-kit/engine';
export type { LayoutAddress, ObjectLayoutView, PageRef } from '@weave-kit/engine/layout';
export { ClientError } from './http.js';
