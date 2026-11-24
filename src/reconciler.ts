// Render-once React host: turns a React element into a plain host tree.
// No updates, no effects that matter, no Suspense: render, commit, read, unmount.
import { createContext, type ReactNode } from 'react';
import Reconciler from 'react-reconciler';
import { DefaultEventPriority, LegacyRoot, NoEventPriority } from 'react-reconciler/constants.js';

export type HostElement = {
  kind: 'element';
  type: string;
  props: Record<string, unknown>;
  children: HostNode[];
};
export type HostText = { kind: 'text'; text: string };
export type HostNode = HostElement | HostText;
type Container = { children: HostNode[] };

const updatesNotSupported = () => {
  throw new Error('react-tagged-pdf renders once; state updates after the first render are not supported.');
};

let currentUpdatePriority: number = NoEventPriority;

// Typed loosely on purpose: the reconciler reads many optional keys and its
// generic host-config type does not track React 19.3's additions precisely.
const hostConfig: any = {
  supportsMutation: true,
  supportsPersistence: false,
  supportsHydration: false,
  isPrimaryRenderer: false,

  createInstance(type: string, props: Record<string, unknown>): HostElement {
    const { children: _children, ...rest } = props;
    return { kind: 'element', type, props: rest, children: [] };
  },
  createTextInstance(text: string): HostText {
    return { kind: 'text', text };
  },
  appendInitialChild(parent: HostElement, child: HostNode) {
    parent.children.push(child);
  },
  appendChild(parent: HostElement, child: HostNode) {
    parent.children.push(child);
  },
  appendChildToContainer(container: Container, child: HostNode) {
    container.children.push(child);
  },
  insertBefore: updatesNotSupported,
  insertInContainerBefore: updatesNotSupported,
  removeChild() {},
  removeChildFromContainer() {},
  clearContainer(container: Container) {
    container.children = [];
  },
  finalizeInitialChildren: () => false,
  shouldSetTextContent: () => false,
  // Must be non-null, otherwise React reports "Expected host context to exist".
  getRootHostContext: () => ({}),
  getChildHostContext: (parentContext: object) => parentContext,
  getPublicInstance: (instance: unknown) => instance,
  prepareForCommit: () => null,
  resetAfterCommit() {},
  preparePortalMount() {},
  scheduleTimeout: setTimeout,
  cancelTimeout: clearTimeout,
  noTimeout: -1,
  supportsMicrotasks: true,
  scheduleMicrotask: queueMicrotask,

  setCurrentUpdatePriority(p: number) {
    currentUpdatePriority = p;
  },
  getCurrentUpdatePriority: () => currentUpdatePriority,
  resolveUpdatePriority: () => currentUpdatePriority || DefaultEventPriority,
  getInstanceFromNode: () => null,
  beforeActiveInstanceBlur() {},
  afterActiveInstanceBlur() {},
  prepareScopeUpdate() {},
  getInstanceFromScope: () => null,
  detachDeletedInstance() {},

  maySuspendCommit: () => false,
  preloadInstance: () => true,
  startSuspendingCommit() {},
  suspendInstance() {},
  waitForCommitToBeReady: () => null,
  NotPendingTransition: null,
  HostTransitionContext: createContext(null),
  resetFormInstance() {},
  requestPostPaintCallback() {},
  shouldAttemptEagerTransition: () => false,
  trackSchedulerEvent() {},
  resolveEventType: () => null,
  resolveEventTimeStamp: () => -1.1,

  commitUpdate: updatesNotSupported,
  commitTextUpdate: updatesNotSupported,
  commitMount() {},
  resetTextContent() {},
  hideInstance() {},
  unhideInstance() {},
  hideTextInstance() {},
  unhideTextInstance() {},

  rendererPackageName: 'react-tagged-pdf',
  rendererVersion: '0.0.0',
  extraDevToolsConfig: null,
};

const reconciler = Reconciler(hostConfig);

/** Render `element` once and return the committed host tree. Errors thrown while rendering are rethrown. */
export function renderTree(element: ReactNode): HostNode[] {
  const container: Container = { children: [] };
  let error: unknown;
  let failed = false;
  // React 19 does not rethrow render errors; it reports them to these callbacks.
  const onError = (e: unknown) => {
    if (!failed) {
      failed = true;
      error = e;
    }
  };
  const root = (reconciler as any).createContainer(
    container, LegacyRoot, null, false, null, '', onError, onError, onError, null,
  );
  (reconciler as any).updateContainerSync(element, root, null, null);
  (reconciler as any).flushSyncWork();
  const children = container.children;
  (reconciler as any).updateContainerSync(null, root, null, null);
  (reconciler as any).flushSyncWork();
  if (failed) throw error;
  return children;
}
