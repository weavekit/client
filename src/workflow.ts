import type { HttpOptions } from './http.js';
import { request } from './http.js';

/** one transition the caller may fire from the record's current state */
export interface WorkflowAction {
  action: string;
  /** target state */
  to: string;
  labels?: Record<string, string>;
}

/** `GET /api/objects/:name/:id/workflow` — current state + available transitions */
export interface WorkflowState {
  state: string;
  /** the object's initial state */
  initial: string;
  actions: WorkflowAction[];
}

/** workflow accessor for objects that declare `objects/<name>/workflow.json` */
export interface WorkflowClient {
  /** current state and the transitions this identity may fire */
  get(object: string, id: string): Promise<WorkflowState>;
  /** fire a transition; resolves to the updated record */
  transition<T = Record<string, unknown>>(object: string, id: string, action: string): Promise<T>;
}

export function createWorkflowClient(http: HttpOptions): WorkflowClient {
  return {
    get(object: string, id: string): Promise<WorkflowState> {
      return request<WorkflowState>(
        http,
        'GET',
        `/objects/${encodeURIComponent(object)}/${encodeURIComponent(id)}/workflow`,
      );
    },
    transition<T = Record<string, unknown>>(object: string, id: string, action: string): Promise<T> {
      return request<T>(
        http,
        'POST',
        `/objects/${encodeURIComponent(object)}/${encodeURIComponent(id)}/transitions/${encodeURIComponent(action)}`,
      );
    },
  };
}
